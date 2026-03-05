import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("cv_consistency_score")
    .eq("id", user.id)
    .maybeSingle()

  if (pErr) {
    return NextResponse.json({ error: "profile_query_failed", details: pErr.message }, { status: 400 })
  }

  const { data: experiences, error: eErr } = await supabase
    .from("profile_experiences")
    .select("company_name,role_title,start_date,end_date,description,matched_verification_id,confidence")
    .eq("user_id", user.id)
    .order("start_date", { ascending: false })

  if (eErr) {
    return NextResponse.json({ error: "experiences_query_failed", details: eErr.message }, { status: 400 })
  }

  return NextResponse.json({
    score: profile?.cv_consistency_score ?? 0,
    experiences: experiences ?? []
  })
}
