import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params

  const supabase = await createClient()

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 })
  }

  const { data: verification, error } = await supabase
    .from("verification_requests")
    .select("id, candidate_id")
    .eq("public_token", token)
    .maybeSingle()

  if (error || !verification) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const { data: summary } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", verification.id)
    .maybeSingle()

  const { data: evidences } = await supabase
    .from("evidences")
    .select("id, created_at")
    .eq("verification_id", verification.id)

  const { data: reuse } = await supabase
    .from("verification_reuse_events")
    .select("company_id, created_at")
    .eq("verification_id", verification.id)

  return NextResponse.json({
    verification: summary,
    evidences,
    reuse
  })
}
