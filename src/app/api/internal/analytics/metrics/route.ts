import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireInternalJobToken } from "@/lib/internalJobAuth";

export const runtime = "nodejs";

const ROUTE_VERSION = "internal-analytics-metrics-v1";

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("missing_SUPABASE_URL_or_SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function countEvents(supabase: any, event_name: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("platform_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", event_name)
    .gte("created_at", since);

  if (error) throw new Error(error.message);
  return count || 0;
}

// v1: dedup en app (ok para escala inicial)
async function distinctCount(supabase: any, column: "company_id" | "user_id", days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("platform_events")
    .select(column)
    .gte("created_at", since)
    .not(column, "is", null);

  if (error) throw new Error(error.message);
  const set = new Set((data || []).map((r: any) => r[column]).filter(Boolean));
  return set.size;
}

export async function GET(req: Request) {
  const auth = requireInternalJobToken(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error, route_version: ROUTE_VERSION }, { status: auth.status });

  try {
    const supabase = adminSupabase();

    const kpis_7d = {
      signup: await countEvents(supabase, "signup", 7),
      onboarding_completed: await countEvents(supabase, "onboarding_completed", 7),
      verification_created: await countEvents(supabase, "verification_created", 7),
      evidence_uploaded: await countEvents(supabase, "evidence_uploaded", 7),
      verification_reused: await countEvents(supabase, "verification_reused", 7),
      public_cv_viewed: await countEvents(supabase, "public_cv_viewed", 7),
      active_companies: await distinctCount(supabase, "company_id", 7),
      active_users: await distinctCount(supabase, "user_id", 7),
    };

    const kpis_30d = {
      signup: await countEvents(supabase, "signup", 30),
      onboarding_completed: await countEvents(supabase, "onboarding_completed", 30),
      verification_created: await countEvents(supabase, "verification_created", 30),
      evidence_uploaded: await countEvents(supabase, "evidence_uploaded", 30),
      verification_reused: await countEvents(supabase, "verification_reused", 30),
      public_cv_viewed: await countEvents(supabase, "public_cv_viewed", 30),
      active_companies: await distinctCount(supabase, "company_id", 30),
      active_users: await distinctCount(supabase, "user_id", 30),
    };

    const reuse_rate_30d =
      kpis_30d.verification_created > 0
        ? Math.round((kpis_30d.verification_reused / kpis_30d.verification_created) * 1000) / 10
        : 0;

    const onboarding_rate_30d =
      kpis_30d.signup > 0
        ? Math.round((kpis_30d.onboarding_completed / kpis_30d.signup) * 1000) / 10
        : 0;

    return NextResponse.json({
      ok: true,
      route_version: ROUTE_VERSION,
      kpis_7d,
      kpis_30d,
      ratios: {
        reuse_rate_30d_pct: reuse_rate_30d,
        onboarding_completion_rate_30d_pct: onboarding_rate_30d,
      },
      notes: {
        v1_limits: "distinct counts dedup en app; si crece, mover a VIEW SQL con COUNT(DISTINCT).",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "server_error", details: String(e?.message || e), route_version: ROUTE_VERSION }, { status: 500 });
  }
}
