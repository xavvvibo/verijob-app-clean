import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isUnavailableLifecycleStatus } from "@/lib/account/lifecycle";

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("missing_supabase_service_role_env")
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

function statusPublic(summary: any) {
  if (!summary) return "unknown"
  const isRevoked = Boolean(summary.is_revoked) || Boolean(summary.revoked_at)
  if (isRevoked) return "revoked"
  return summary.status || "unknown"
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 })

  let supabase
  try {
    supabase = adminSupabase()
  } catch (e: any) {
    return NextResponse.json(
      { error: "server_misconfigured", detail: e?.message || "missing_env" },
      { status: 500 }
    )
  }

  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .select("id")
    .eq("public_token", token)
    .maybeSingle()

  if (vrErr || !vr) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { data: summary, error: sumErr } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", vr.id)
    .maybeSingle()

  if (sumErr || !summary) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if ((summary as any)?.candidate_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("lifecycle_status")
      .eq("id", (summary as any).candidate_id)
      .maybeSingle()
    if (isUnavailableLifecycleStatus((profile as any)?.lifecycle_status)) {
      return NextResponse.json({ error: "profile_unavailable" }, { status: 410 })
    }
  }

  const { count: evidenceCount } = await supabase
    .from("evidences")
    .select("*", { count: "exact", head: true })
    .eq("verification_id", vr.id)

  const { count: reuseCount } = await supabase
    .from("verification_reuse_events")
    .select("*", { count: "exact", head: true })
    .eq("verification_id", vr.id)

  const status_public = statusPublic(summary)

  const payload = {
    verification: {
      verification_id: summary.verification_id,
      status: summary.status,
      status_public,
      company_confirmed: summary.company_confirmed,
      evidence_count: summary.evidence_count ?? evidenceCount ?? 0,
      actions_count: summary.actions_count ?? 0,
      is_revoked: summary.is_revoked ?? false,
      revoked_at: summary.revoked_at ?? null,
      revoked_reason: summary.revoked_reason ?? null
    },
    metrics: {
      evidence_count: evidenceCount ?? summary.evidence_count ?? 0,
      reuse_count: reuseCount ?? 0
    }
  }

  return NextResponse.json(payload)
}
