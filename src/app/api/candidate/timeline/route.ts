import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

function ymToInt(ym: string | null | undefined) {
  const s = (ym || "").trim()
  if (!s) return null
  const m1 = s.match(/^(\d{4})-(\d{2})/)
  if (m1) return parseInt(m1[1], 10) * 12 + (parseInt(m1[2], 10) - 1)
  const m2 = s.match(/^(\d{4})$/)
  if (m2) return parseInt(m2[1], 10) * 12
  return null
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const userId = user.id

  const { data: cp } = await supabase
    .from("candidate_profiles")
    .select("experiences")
    .eq("user_id", userId)
    .maybeSingle()

  const experiences = Array.isArray(cp?.experiences) ? cp.experiences : []

  const { data: verifications } = await supabase
    .from("verification_summary")
    .select("verification_id,company_name_freeform,position,start_date,end_date,status,company_confirmed,evidence_count")
    .eq("candidate_id", userId)

  const cvTimeline = experiences.map((e: any) => ({
    source: "cv",
    company: e.company || e.company_name || null,
    position: e.position || e.title || null,
    start: e.start || e.start_date || null,
    end: e.end || e.end_date || null
  }))

  const verifiedTimeline = (verifications || []).map((v: any) => ({
    source: "verification",
    verification_id: v.verification_id,
    company: v.company_name_freeform,
    position: v.position,
    start: v.start_date,
    end: v.end_date,
    status: v.status,
    company_confirmed: v.company_confirmed,
    evidence_count: v.evidence_count
  }))

  const timeline = [...cvTimeline, ...verifiedTimeline]

  timeline.sort((a: any, b: any) => {
    const da = ymToInt(a.end || a.start || "")
    const db = ymToInt(b.end || b.start || "")
    return (db || 0) - (da || 0)
  })

  return NextResponse.json({
    items: timeline,
    counts: {
      cv: cvTimeline.length,
      verifications: verifiedTimeline.length
    }
  })
}
