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

  let out = experiences ?? []
  if (out.length === 0) {
    const { data: fallbackRows, error: fbErr } = await supabase
      .from("experiences")
      .select("company_name,title,start_date,end_date,description")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false })
    if (!fbErr && Array.isArray(fallbackRows)) {
      out = fallbackRows.map((x: any) => ({
        company_name: x.company_name ?? null,
        role_title: x.title ?? null,
        start_date: x.start_date ?? null,
        end_date: x.end_date ?? null,
        description: x.description ?? null,
        matched_verification_id: null,
        confidence: null,
      }))
    }
  }

  return NextResponse.json({
    score: profile?.cv_consistency_score ?? 0,
    experiences: out
  })
}
