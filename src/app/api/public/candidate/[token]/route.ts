import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { normalizePublicLanguages } from "@/lib/public/profile-languages";
import { resolveActiveCandidatePublicLink } from "@/lib/public/candidate-public-link";

type Params = { token: string };

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
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

function normalizeSubscriptionStatus(value: unknown) {
  const status = String(value || "").toLowerCase();
  if (!status) return "none";
  return status;
}

function canShowPublicQr(planRaw: unknown, statusRaw: unknown) {
  const plan = String(planRaw || "").toLowerCase();
  const status = normalizeSubscriptionStatus(statusRaw);
  const active = status === "active" || status === "trialing";
  if (!active) return false;
  if (!plan || plan === "free") return false;
  return plan.startsWith("candidate_");
}

function asArray(v: any) {
  return Array.isArray(v) ? v : [];
}

function asText(v: unknown, max = 300) {
  return String(v || "").trim().slice(0, max);
}

function toEvidenceVerificationBadge(rawType: unknown) {
  const v = String(rawType || "").toLowerCase();
  if (!v) return null;
  if (v.includes("contract")) return "Contrato validado";
  if (v.includes("payroll") || v.includes("nomina")) return "Nómina validada";
  if (v.includes("social") || v.includes("vida_laboral")) return "Informe de vida laboral validado";
  if (v.includes("reference")) return "Referencia empresarial verificada";
  if (v.includes("documentary")) return "Verificación documental";
  if (v.includes("certificate")) return "Certificado validado";
  return "Verificación documental";
}

function getRoleSkills(experiences: any[]) {
  const stopWords = new Set(["de", "la", "el", "en", "y", "con", "para", "del"]);
  const counts = new Map<string, number>();
  for (const row of experiences) {
    const source = String(row?.position || "");
    for (const token of source.toLowerCase().split(/[^a-zA-Záéíóúüñ0-9]+/g)) {
      const t = token.trim();
      if (!t || t.length < 3 || stopWords.has(t)) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { token: tokenParam } = await ctx.params;

  const admin = createServiceRoleClient();

  const linkResolved = await resolveActiveCandidatePublicLink(admin, tokenParam);
  if (linkResolved.ok === false) {
    if (linkResolved.reason === "expired") return json(410, { error: "link_expired" });
    return json(404, { error: "not_found" });
  }

  const candidateId = String(linkResolved.link.candidate_id || "");
  if (!candidateId) return json(404, { error: "not_found" });

  const { data: profileColumnsRes } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "profiles");
  const profileColumns = new Set((profileColumnsRes || []).map((row: any) => String(row?.column_name || "")));
  const profileSelect = [
    "full_name",
    "title",
    "location",
    "languages",
    profileColumns.has("lifecycle_status") ? "lifecycle_status" : null,
    profileColumns.has("deleted_at") ? "deleted_at" : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data: profile } = await admin
    .from("profiles")
    .select(profileSelect)
    .eq("id", candidateId)
    .maybeSingle();
  const lifecycleStatus = String((profile as any)?.lifecycle_status || "active").toLowerCase();
  if (lifecycleStatus === "deleted" || lifecycleStatus === "disabled") {
    return json(410, { error: "profile_unavailable" });
  }

  const { data: cp } = await admin
    .from("candidate_profiles")
    .select("summary,education,achievements,other_achievements,trust_score,trust_score_breakdown,job_search_status,preferred_workday,preferred_roles,work_zones")
    .eq("user_id", candidateId)
    .maybeSingle();

  const { data: latestSub } = await admin
    .from("subscriptions")
    .select("plan,status,created_at")
    .eq("user_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(1)
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

  const { data: evidenceRows } = verificationIds.length
    ? await admin
        .from("evidences")
        .select("verification_request_id,document_type,evidence_type,validation_status,document_scope")
        .in("verification_request_id", verificationIds)
    : ({ data: [] } as any);
  const evidenceByVerification = new Map<string, any[]>();
  for (const evidence of asArray(evidenceRows)) {
    const key = String((evidence as any)?.verification_request_id || "");
    if (!key) continue;
    const current = evidenceByVerification.get(key) || [];
    current.push(evidence);
    evidenceByVerification.set(key, current);
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

  const verificationsById = new Map<string, any>((rows || []).map((x: any) => [String(x?.verification_id || ""), x]));
  const experiencesEnriched = experiences.map((item: any) => {
    const verificationId = String(item?.experience_id || "");
    const linkedVerification = verificationsById.get(verificationId) || null;
    const linkedEvidences = evidenceByVerification.get(verificationId) || [];
    const badges = new Set<string>();
    const method = String(linkedVerification?.verification_channel || "").toLowerCase();
    const status = String(item?.status_text || "").toLowerCase();
    if (status === "verified" || status === "approved") badges.add("Verificado por empresa");
    if (method === "documentary") badges.add("Verificación documental");
    for (const ev of linkedEvidences) {
      const b = toEvidenceVerificationBadge((ev as any)?.document_type || (ev as any)?.evidence_type);
      if (b) badges.add(b);
    }
    if (!badges.size && Number(item?.evidence_count || 0) > 0) badges.add("Verificación documental");
    return {
      ...item,
      verification_method: method || null,
      verification_badges: Array.from(badges),
      is_verified: status === "verified" || status === "approved",
    };
  });

  const educationItems = asArray((cp as any)?.education).map((item: any, idx: number) => ({
    id: String(item?.id || `edu-${idx}`),
    title: asText(item?.title || item?.degree || item?.program, 180) || "Formación",
    institution: asText(item?.institution || item?.school || item?.center, 180) || null,
    start_date: asText(item?.start_date || item?.start || item?.from, 30) || null,
    end_date: asText(item?.end_date || item?.end || item?.to, 30) || null,
    description: asText(item?.description || item?.notes, 500) || null,
  }));

  const rawAchievements = asArray((cp as any)?.achievements).length
    ? asArray((cp as any)?.achievements)
    : asArray((cp as any)?.other_achievements);
  const achievementItems = rawAchievements
    .map((item: any) => asText(item, 140))
    .filter(Boolean);

  const derivedRecommendations = rows
    .filter((r: any) => isVerifiedStatus(r?.status))
    .map((r: any, idx: number) => {
      const note = asText((r as any)?.resolution_notes || (r as any)?.company_comment || (r as any)?.comment, 420);
      return {
        id: String((r as any)?.verification_id || `rec-${idx}`),
        name: asText((r as any)?.reviewer_name || "Responsable de empresa", 120),
        role: asText((r as any)?.reviewer_role || "Verificación empresarial", 120),
        company: asText((r as any)?.company_name || (r as any)?.company_name_target, 160) || "Empresa verificada",
        text: note || "Experiencia validada por empresa dentro del proceso de verificación.",
        date: (r as any)?.resolved_at || (r as any)?.created_at || null,
        verified: true,
      };
    })
    .slice(0, 10);

  const verifiedSkills = Array.from(
    new Set([
      ...getRoleSkills(experiencesEnriched),
      ...achievementItems.slice(0, 8),
    ])
  ).slice(0, 14);

  const profileFullName = asText((profile as any)?.full_name, 140) || "Candidato verificado";
  const profileTitle = asText((profile as any)?.title, 140) || null;
  const profileLocation = asText((profile as any)?.location, 140) || null;
  const profileSummary = asText((cp as any)?.summary, 1200) || null;
  const availability = asText((cp as any)?.job_search_status, 80) || null;
  const workMode = asText((cp as any)?.preferred_workday, 80) || null;
  const sector = asText(asArray((cp as any)?.preferred_roles)?.[0], 120) || null;
  return json(200, {
    route_version: "public-candidate-token-v1",
    token: linkResolved.token,
    candidate_id: candidateId,
    teaser: {
      full_name: profileFullName,
      title: profileTitle,
      location: profileLocation,
      languages: normalizePublicLanguages((profile as any)?.languages),
      summary: profileSummary,
      trust_score: trustScore,
      experiences_total: rows.length,
      verified_experiences: verifiedRows.length,
      confirmed_experiences: confirmed,
      evidences_total: evidences,
      evidences_count: evidences,
      education_total: educationTotal,
      achievements_total: achievementsRaw.length,
      verified_work_count: verifiedWork,
      verified_education_count: verifiedEducation,
      total_verifications: totalVerifications,
      profile_status: profileStatus,
      profile_visibility: "public_link",
      lifecycle_status: lifecycleStatus,
      subscription_plan: latestSub?.plan || "free",
      subscription_status: normalizeSubscriptionStatus(latestSub?.status),
      qr_enabled: canShowPublicQr(latestSub?.plan, latestSub?.status),
      availability,
      work_mode: workMode,
      sector,
    },
    experiences: experiencesEnriched,
    education: educationItems,
    recommendations: derivedRecommendations,
    achievements: achievementItems,
    verified_skills: verifiedSkills,
    candidate_public_profile: {
      identity: {
        candidate_id: candidateId,
        full_name: profileFullName,
      },
      headline: profileTitle,
      location: profileLocation,
      languages: normalizePublicLanguages((profile as any)?.languages),
      education: educationItems,
      experiences: experiencesEnriched,
      verifications: {
        total: totalVerifications,
        verified_work_count: verifiedWork,
        verified_education_count: verifiedEducation,
        confirmed_experiences: confirmed,
        evidences_total: evidences,
      },
      trust_score: {
        value: trustScore,
      },
      recommendations: derivedRecommendations,
      skills: verifiedSkills,
    },
  });
}
