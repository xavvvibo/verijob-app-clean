import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

type Params = { token: string };

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isHex48(token: string) {
  return /^[a-f0-9]{48}$/i.test(token);
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { token } = await ctx.params;

  if (!token || !isHex48(token)) return json(404, { error: "not_found" });

  const admin = createServiceRoleClient();

  const { data: link, error: linkErr } = await admin
    .from("candidate_public_links")
    .select("id,candidate_id,expires_at,is_active")
    .eq("public_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (linkErr || !link) return json(404, { error: "not_found" });
  if (isExpired(link.expires_at)) return json(410, { error: "link_expired" });

  const candidateId = String(link.candidate_id || "");
  if (!candidateId) return json(404, { error: "not_found" });

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name,title,location")
    .eq("id", candidateId)
    .maybeSingle();

  const { data: cp } = await admin
    .from("candidate_profiles")
    .select("summary,education,achievements,other_achievements,trust_score,trust_score_breakdown")
    .eq("user_id", candidateId)
    .maybeSingle();

  const { data: verifications } = await admin
    .from("verification_summary")
    .select("verification_id,status,company_confirmed,evidence_count")
    .eq("candidate_id", candidateId);

  const rows = Array.isArray(verifications) ? verifications : [];
  const verificationIds = rows.map((r: any) => r.verification_id).filter(Boolean);

  let reuseEvents = 0;
  let reuseCompanies = 0;
  if (verificationIds.length) {
    const { data: reuseRows } = await admin
      .from("verification_reuse_events")
      .select("verification_id,company_id")
      .in("verification_id", verificationIds);
    const rr = Array.isArray(reuseRows) ? reuseRows : [];
    reuseEvents = rr.length;
    reuseCompanies = new Set(rr.map((x: any) => x.company_id).filter(Boolean)).size;
  }

  const verified = rows.filter((r: any) => {
    const s = String(r?.status || "").toLowerCase();
    return s === "approved" || s === "verified";
  }).length;

  const confirmed = rows.filter((r: any) => !!r?.company_confirmed).length;
  const evidences = rows.reduce((acc: number, r: any) => acc + Number(r?.evidence_count || 0), 0);

  const educationTotal = Array.isArray(cp?.education) ? cp.education.length : 0;
  const achievementsRaw = Array.isArray(cp?.achievements)
    ? cp.achievements
    : Array.isArray(cp?.other_achievements)
      ? cp.other_achievements
      : [];

  const trustScore = Number(cp?.trust_score ?? 0);

  return json(200, {
    route_version: "public-candidate-token-v1",
    token,
    candidate_id: candidateId,
    teaser: {
      full_name: profile?.full_name || "Candidato verificado",
      title: profile?.title || null,
      location: profile?.location || null,
      summary: cp?.summary || null,
      trust_score: trustScore,
      trust_score_breakdown: cp?.trust_score_breakdown || null,
      experiences_total: rows.length,
      verified_experiences: verified,
      confirmed_experiences: confirmed,
      evidences_total: evidences,
      reuse_total: reuseEvents,
      reuse_companies: reuseCompanies,
      education_total: educationTotal,
      achievements_total: achievementsRaw.length,
      profile_visibility: "public_link",
    },
  });
}
