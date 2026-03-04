import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import crypto from "crypto"

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("missing_supabase_service_role_env")
  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 })

  // 1) Auth (candidate logged-in)
  const supabase = await createClient()
  const { data: au } = await supabase.auth.getUser()
  const user = au?.user
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 2) Ownership check (must be candidate owner of the verification_request)
  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .select("id, candidate_id, public_token")
    .eq("id", id)
    .maybeSingle()

  if (vrErr || !vr) return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (vr.candidate_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  // 3) Ensure token exists (service role write to bypass RLS safely)
  let token = vr.public_token as string | null
  if (!token) {
    token = crypto.randomBytes(16).toString("hex")
    const admin = adminSupabase()
    const { error: upErr } = await admin
      .from("verification_requests")
      .update({ public_token: token })
      .eq("id", id)

    if (upErr) return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }

  const baseUrl = "https://app.verijob.es"
  const url = `${baseUrl}/v/${token}`

  return NextResponse.json({ token, url })
}
