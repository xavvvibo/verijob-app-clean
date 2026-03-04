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

function first<T = any>(...vals: any[]): T | null {
  for (const v of vals) {
    if (v === null || v === undefined) continue
    if (typeof v === "string" && v.trim() === "") continue
    return v as T
  }
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
    .select("*")
    .eq("candidate_id", userId)

  const cvTimeline = experiences.map((e: any) => ({
    source: "cv",
    company: first(e.company, e.company_name, e.employer, e.organization),
    position: first(e.position, e.title, e.role),
    start: first(e.start, e.start_date, e.from, e.from_date),
    end: first(e.end, e.end_date, e.to, e.to_date),
    missing_fields: []
  }))

  const verifiedTimeline = (verifications || []).map((v: any) => {
    const company = first(
      v.company_name_freeform,
      v.company_name,
      v.company,
      v.employer,
      (v.company_profile && v.company_profile.name) ? v.company_profile.name : null
    )

    const position = first(v.position, v.role, v.job_title)
    const start = first(v.start_date, v.start, v.from_date, v.from)
    const end = first(v.end_date, v.end, v.to_date, v.to)

    const missing: string[] = []
    if (!company) missing.push("company")
    if (!position) missing.push("position")
    if (!start) missing.push("start_date")

    return {
      source: "verification",
      verification_id: v.verification_id,
      company: company || "Empresa",
      position: position || "Puesto",
      start,
      end,
      status: v.status,
      company_confirmed: v.company_confirmed,
      evidence_count: v.evidence_count,
      actions_count: v.actions_count,
      is_revoked: v.is_revoked,
      revoked_at: v.revoked_at,
      missing_fields: missing
    }
  })

  const timeline = [...cvTimeline, ...verifiedTimeline]

  timeline.sort((a: any, b: any) => {
    const da = ymToInt(a.end || a.start || "")
    const db = ymToInt(b.end || b.start || "")
    return (db || 0) - (da || 0)
  })

  return NextResponse.json({
    items: timeline,
    counts: { cv: cvTimeline.length, verifications: verifiedTimeline.length }
  })
}
