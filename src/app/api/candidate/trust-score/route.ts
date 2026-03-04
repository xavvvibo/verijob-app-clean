import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n))
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const userId = user.id

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

  // revocación solo cuenta como señal negativa si había señal positiva previa (approved o confirmed)
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

  let score = (R * 40) + (V * 25) + (A * 20) + (U * 15)

  // penalización suavizada (hasta -20)
  const penalty = Math.min(20, revokedEffective * 10)
  score -= penalty

  const trust = clamp(Math.round(score))

  const breakdown = {
    total, approved, confirmed, evidences, reuseEvents, reuseCompanies,
    revoked_effective: revokedEffective,
    components: {
      R: Math.round(R * 40),
      V: Math.round(V * 25),
      A: Math.round(A * 20),
      U: Math.round(U * 15),
      penalty_revoked: penalty,
    }
  }

  const { error: upErr } = await supabase
    .from("candidate_profiles")
    .update({ trust_score: trust, trust_score_breakdown: breakdown })
    .eq("user_id", userId)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  return NextResponse.json({ trust_score: trust, breakdown })
}
