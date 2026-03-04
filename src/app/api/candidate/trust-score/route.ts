import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n))
}

function ymToInt(ym: string) {
  // acepta "YYYY-MM" o "YYYY"
  const s = (ym || "").trim()
  if (!s) return null
  const m1 = s.match(/^(\d{4})-(\d{2})/)
  if (m1) return parseInt(m1[1], 10) * 12 + (parseInt(m1[2], 10) - 1)
  const m2 = s.match(/^(\d{4})$/)
  if (m2) return parseInt(m2[1], 10) * 12
  return null
}

function consistencyFromCv(raw: any) {
  const exps: any[] = Array.isArray(raw?.experiences) ? raw.experiences : []
  if (!exps.length) {
    return { cv_consistency_score: 0, breakdown: { reason: "no_experiences" } }
  }

  let missingDates = 0
  let invertedDates = 0

  const ranges: Array<{ start: number, end: number }> = []

  for (const e of exps) {
    const s = ymToInt(e?.start || e?.start_date || "")
    const en = ymToInt(e?.end || e?.end_date || "") ?? ymToInt(String(new Date().getFullYear()))
    if (s == null) {
      missingDates++
      continue
    }
    if (en != null && en < s) invertedDates++
    ranges.push({ start: s, end: en ?? s })
  }

  ranges.sort((a, b) => a.start - b.start)

  // gaps (meses sin experiencia) tolerancia 3 meses
  let gapMonths = 0
  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1]
    const cur = ranges[i]
    const gap = cur.start - prev.end
    if (gap > 3) gapMonths += (gap - 3)
  }

  // score base 100 y penalizaciones
  let score = 100
  score -= missingDates * 10
  score -= invertedDates * 20
  score -= Math.min(40, Math.floor(gapMonths / 6) * 10) // -10 por cada 6 meses de gap efectivo

  score = clamp(score, 0, 100)

  return {
    cv_consistency_score: score,
    breakdown: {
      experiences: exps.length,
      missingDates,
      invertedDates,
      gapMonths,
      penalties: {
        missingDates: missingDates * 10,
        invertedDates: invertedDates * 20,
        gaps: Math.min(40, Math.floor(gapMonths / 6) * 10)
      }
    }
  }
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const userId = user.id

  // 1) señal CV (raw_cv_json)
  const { data: cp, error: cpErr } = await supabase
    .from("candidate_profiles")
    .select("raw_cv_json")
    .eq("user_id", userId)
    .maybeSingle()

  if (cpErr) return NextResponse.json({ error: cpErr.message }, { status: 400 })

  const cv = consistencyFromCv(cp?.raw_cv_json || null)

  // 2) señal verificaciones (verification_summary)
  const { data: rows, error } = await supabase
    .from("verification_summary")
    .select("verification_id,status,company_confirmed,evidence_count,is_revoked")
    .eq("candidate_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const verifications = rows || []
  const total = verifications.length
  const approved = verifications.filter(v => (v.status || "").toLowerCase() === "approved").length
  const confirmed = verifications.filter(v => !!v.company_confirmed).length
  const evidences = verifications.reduce((acc, v) => acc + (v.evidence_count || 0), 0)

  const revokedEffective = verifications.filter(v => {
    const s = (v.status || "").toLowerCase()
    const positive = s === "approved" || !!v.company_confirmed
    return !!v.is_revoked && positive
  }).length

  const ids = verifications.map(v => v.verification_id).filter(Boolean)
  let reuseEvents = 0
  let reuseCompanies = 0

  if (ids.length) {
    const { data: reData } = await supabase
      .from("verification_reuse_events")
      .select("company_id,verification_id")
      .in("verification_id", ids)

    const re = reData || []
    reuseEvents = re.length
    reuseCompanies = new Set(re.map((x: any) => x.company_id).filter(Boolean)).size
  }

  const R = total ? approved / total : 0
  const V = total ? confirmed / total : 0
  const A = total ? Math.min(1, evidences / (total * 2)) : 0
  const U = Math.min(1, reuseCompanies / 5)

  let score = (R * 35) + (V * 22) + (A * 18) + (U * 10)

  // CV consistency aporta hasta +15 (proporcional)
  const cvBoost = Math.round((cv.cv_consistency_score / 100) * 15)
  score += cvBoost

  const penalty = Math.min(20, revokedEffective * 10)
  score -= penalty

  const trust = clamp(Math.round(score))

  const breakdown = {
    total, approved, confirmed, evidences, reuseEvents, reuseCompanies,
    revoked_effective: revokedEffective,
    cv_consistency_score: cv.cv_consistency_score,
    cv_boost: cvBoost,
    cv_consistency_breakdown: cv.breakdown,
    components: {
      R: Math.round(R * 35),
      V: Math.round(V * 22),
      A: Math.round(A * 18),
      U: Math.round(U * 10),
      cv_boost: cvBoost,
      penalty_revoked: penalty
    }
  }

  const { error: upErr } = await supabase
    .from("candidate_profiles")
    .update({
      trust_score: trust,
      trust_score_breakdown: breakdown,
      cv_consistency_score: cv.cv_consistency_score,
      cv_consistency_breakdown: cv.breakdown
    })
    .eq("user_id", userId)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  return NextResponse.json({ trust_score: trust, breakdown })
}
