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

function isVerifiedStatus(status: any) {
  const s = String(status || "").toLowerCase();
  return s === "approved" || s === "verified";
}

function isEducationVerification(row: any) {
  const candidates = [
    row?.verification_type,
    row?.type,
    row?.category,
    row?.kind,
    row?.request_type,
    row?.entity_type,
    row?.title,
    row?.position,
    row?.institution,
    row?.school,
    row?.degree,
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());

  const joined = candidates.join(" ");
  return /(educ|academ|formaci|study|degree|univers|school|curso|master|fp|bachiller)/i.test(joined);
}

function resolveProfileStatus(args: {
  totalVerifications: number;
  evidencesCount: number;
  trustScore: number;
}) {
  if (args.totalVerifications === 0 && args.evidencesCount === 0) return "reviewing";
  if (args.totalVerifications >= 3 || args.trustScore >= 80) return "verified";
  return "partially_verified";
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
    .select("*")
    .eq("candidate_id", candidateId);

  const rows = Array.isArray(verifications) ? verifications : [];
  const verificationById = new Map<string, any>();
  for (const row of rows) {
    const verificationId = String((row as any)?.verification_id || "");
    if (verificationId) verificationById.set(verificationId, row);
  }
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

  const verifiedRows = rows.filter((r: any) => isVerifiedStatus(r?.status));
  const verifiedWork = verifiedRows.filter((r: any) => !isEducationVerification(r)).length;
  const verifiedEducation = verifiedRows.filter((r: any) => isEducationVerification(r)).length;
  const totalVerifications = verifiedWork + verifiedEducation;

  const confirmed = rows.filter((r: any) => !!r?.company_confirmed).length;
  const evidences = rows.reduce(
    (acc: number, r: any) => acc + Number(r?.evidence_count ?? r?.evidences_count ?? 0),
    0
  );

  const educationTotal = Array.isArray(cp?.education) ? cp.education.length : 0;
  const achievementsRaw = Array.isArray(cp?.achievements)
    ? cp.achievements
    : Array.isArray(cp?.other_achievements)
      ? cp.other_achievements
      : [];

  const trustScore = Number(cp?.trust_score ?? 0);
  const profileStatus = resolveProfileStatus({
    totalVerifications,
    evidencesCount: evidences,
    trustScore,
  });

  const { data: employmentRecords } = await admin
    .from("employment_records")
    .select("id,position,company_name_freeform,start_date,end_date,verification_status,last_verification_request_id,company_verification_status_snapshot")
    .eq("candidate_id", candidateId)
    .order("start_date", { ascending: false })
    .limit(24);

  const experiencesFromEmployment = (Array.isArray(employmentRecords) ? employmentRecords : []).map((record: any) => {
    const linkedVerification = verificationById.get(String(record?.last_verification_request_id || ""));
    const statusText = String(
      linkedVerification?.status_effective ||
      linkedVerification?.status ||
      record?.verification_status ||
      "unknown"
    );
    const score = Number(linkedVerification?.score ?? 0);
    const evidenceCount = Number(
      linkedVerification?.evidence_count ?? linkedVerification?.evidences_count ?? 0
    );
    const reuseCount = Number(linkedVerification?.reuse_count ?? 0);
    return {
      experience_id: String(record?.id || ""),
      position: record?.position || null,
      company_name: record?.company_name_freeform || null,
      start_date: record?.start_date || null,
      end_date: record?.end_date || null,
      status_text: statusText,
      score,
      evidence_count: evidenceCount,
      reuse_count: reuseCount,
      company_verification_status_snapshot:
        linkedVerification?.company_verification_status_snapshot ||
        record?.company_verification_status_snapshot ||
        null,
    };
  });

  const experiencesFallback = rows.slice(0, 24).map((row: any, index: number) => ({
    experience_id: String(row?.verification_id || `fallback-${index}`),
    position: row?.position || null,
    company_name: row?.company_name || row?.company_name_target || null,
    start_date: row?.start_date || null,
    end_date: row?.end_date || null,
    status_text: String(row?.status_effective || row?.status || "unknown"),
    score: Number(row?.score ?? 0),
    evidence_count: Number(row?.evidence_count ?? row?.evidences_count ?? 0),
    reuse_count: Number(row?.reuse_count ?? 0),
    company_verification_status_snapshot: row?.company_verification_status_snapshot || null,
  }));

  const experiences = experiencesFromEmployment.length ? experiencesFromEmployment : experiencesFallback;

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
      verified_experiences: verifiedRows.length,
      confirmed_experiences: confirmed,
      evidences_total: evidences,
      evidences_count: evidences,
      reuse_total: reuseEvents,
      reuse_companies: reuseCompanies,
      education_total: educationTotal,
      achievements_total: achievementsRaw.length,
      verified_work_count: verifiedWork,
      verified_education_count: verifiedEducation,
      total_verifications: totalVerifications,
      profile_status: profileStatus,
      profile_visibility: "public_link",
    },
    experiences,
  });
}
