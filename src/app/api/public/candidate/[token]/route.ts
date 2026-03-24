import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { normalizePublicLanguages } from "@/lib/public/profile-languages";
import { resolveActiveCandidatePublicLink } from "@/lib/public/candidate-public-link";
import { isUnavailableLifecycleStatus } from "@/lib/account/lifecycle";
import { getCandidatePlanCapabilities } from "@/lib/billing/planCapabilities";
import {
  EMPLOYMENT_RECORD_VERIFICATION_STATUS,
  isVerifiedEmploymentRecordStatus,
  normalizeEmploymentRecordVerificationStatus,
} from "@/lib/verification/employment-record-verification-status";
import { readCandidateProfileCollections } from "@/lib/candidate/profile-collections";
import { mapCandidateAvailability } from "@/lib/candidate/availability";
import { getTrustBreakdownLegacyCompat, getTrustVerificationLabel, normalizeTrustBreakdown } from "@/lib/trust/trust-model";

type Params = { token: string };

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isVerifiedStatus(status: any) {
  return isVerifiedEmploymentRecordStatus(status);
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

function asArray(v: any) {
  return Array.isArray(v) ? v : [];
}

function asText(v: unknown, max = 300) {
  return String(v || "").trim().slice(0, max);
}

function formatAchievementEntry(item: any) {
  const category = asText(item?.category, 40).toLowerCase();
  if (category === "idioma") return null;
  const title = asText(item?.title, 140) || "Logro";
  const issuer = asText(item?.issuer, 120);
  const date = asText(item?.date, 40);
  const description = asText(item?.description, 220);
  const parts = [title, issuer, date].filter(Boolean);
  const summary = parts.join(" · ");
  return description ? `${summary} — ${description}` : summary;
}

function toPublicName(fullNameRaw: unknown) {
  const fullName = String(fullNameRaw || "").trim();
  if (!fullName) return "Candidato verificado";
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (!parts.length) return "Candidato verificado";
  const first = parts[0];
  const secondInitial = parts[1]?.charAt(0)?.toUpperCase();
  return secondInitial ? `${first} ${secondInitial}.` : first;
}

function toEvidenceVerificationBadge(rawType: unknown) {
  const label = getTrustVerificationLabel(rawType);
  return label ? label : "Documental";
}

function isDocumentaryOfficialVerification(row: any) {
  const channel = String(row?.verification_channel || "").trim().toLowerCase();
  const requestContext = row?.request_context && typeof row.request_context === "object" ? row.request_context : {};
  const source = String(requestContext?.verification_source || requestContext?.documentary_processing?.verification_source || "").trim().toLowerCase();
  const method = String(requestContext?.verification_method || requestContext?.documentary_processing?.verification_method || "").trim().toLowerCase();
  const reason = String(requestContext?.verification_reason || requestContext?.documentary_processing?.verification_reason || "").trim().toLowerCase();
  return channel === "documentary" && (
    source === "documentary_official" ||
    method === "official_document_auto" ||
    reason === "vida_laboral_linked_high_confidence" ||
    reason === "vida_laboral_cea_verified_signal"
  );
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
  const reqUrl = new URL(_req.url);
  const requestedScope = String(reqUrl.searchParams.get("scope") || "").toLowerCase();

  const admin = createServiceRoleClient();

  const linkResolved = await resolveActiveCandidatePublicLink(admin, tokenParam);
  if (linkResolved.ok === false) {
    if (linkResolved.reason === "expired") return json(410, { error: "link_expired" });
    return json(404, { error: "not_found" });
  }

  const candidateId = String(linkResolved.link.candidate_id || "");
  if (!candidateId) return json(404, { error: "not_found" });

  let internalPreviewAllowed = false;
  if (requestedScope === "internal") {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    internalPreviewAllowed = Boolean(user?.id && String(user.id) === candidateId);
  }

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
  if (isUnavailableLifecycleStatus(lifecycleStatus)) {
    return json(410, { error: "profile_unavailable" });
  }

  const candidateProfileSelect = [
    "summary",
    "trust_score",
    "trust_score_breakdown",
    "job_search_status",
    "preferred_workday",
    "preferred_roles",
    "work_zones",
  ]
    .filter(Boolean)
    .join(",");

  const { data: cp } = await admin
    .from("candidate_profiles")
    .select(candidateProfileSelect)
    .eq("user_id", candidateId)
    .maybeSingle();
  const candidateCollections = await readCandidateProfileCollections(admin, candidateId, { candidateProfile: cp });

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

  const verifiedRows = rows.filter((r: any) => isVerifiedStatus(r?.status));
  const verifiedWork = verifiedRows.filter((r: any) => !isEducationVerification(r)).length;
  const verifiedEducation = verifiedRows.filter((r: any) => isEducationVerification(r)).length;
  const { data: employmentRecords } = await admin
    .from("employment_records")
    .select("id,position,company_name_freeform,start_date,end_date,verification_status,last_verification_request_id,company_verification_status_snapshot")
    .eq("candidate_id", candidateId)
    .order("start_date", { ascending: false })
    .limit(24);

  const employmentRows = Array.isArray(employmentRecords) ? employmentRecords : [];
  const allVerificationIds = Array.from(
    new Set([
      ...verificationIds,
      ...employmentRows.map((record: any) => record?.last_verification_request_id).filter(Boolean),
    ]),
  );
  const { data: verificationRequests } = allVerificationIds.length
    ? await admin
        .from("verification_requests")
        .select("id,status,verification_channel,request_context,resolved_at,created_at")
        .in("id", allVerificationIds as string[])
    : ({ data: [] } as any);
  const verificationRequestById = new Map<string, any>();
  for (const row of asArray(verificationRequests)) {
    const verificationId = String((row as any)?.id || "");
    if (verificationId) verificationRequestById.set(verificationId, row);
  }
  const { data: evidenceRows } = allVerificationIds.length
    ? await admin
        .from("evidences")
        .select("verification_request_id,document_type,evidence_type,validation_status,document_scope")
        .in("verification_request_id", allVerificationIds)
    : ({ data: [] } as any);
  const evidenceByVerification = new Map<string, any[]>();
  for (const evidence of asArray(evidenceRows)) {
    const key = String((evidence as any)?.verification_request_id || "");
    if (!key) continue;
    const current = evidenceByVerification.get(key) || [];
    current.push(evidence);
    evidenceByVerification.set(key, current);
  }
  const verifiedEmploymentFromRecords = employmentRows.filter((record: any) =>
    isVerifiedEmploymentRecordStatus(record?.verification_status),
  ).length;
  const publicVerifiedExperienceCount = Math.max(verifiedRows.length, verifiedEmploymentFromRecords);
  const totalVerifications = Math.max(verifiedWork + verifiedEducation, verifiedEmploymentFromRecords);

  const confirmed = rows.filter((r: any) => !!r?.company_confirmed).length;
  const evidences = rows.reduce(
    (acc: number, r: any) => acc + Number(r?.evidence_count ?? r?.evidences_count ?? 0),
    0
  );

  const candidateProfile = (cp as any) || null;
  const educationTotal = candidateCollections.education.length;

  const trustScore = Number(candidateProfile?.trust_score ?? 0);
  const normalizedTrustBreakdown = normalizeTrustBreakdown(candidateProfile?.trust_score_breakdown);
  const legacyTrustBreakdown = getTrustBreakdownLegacyCompat(candidateProfile?.trust_score_breakdown);
  const profileStatus = resolveProfileStatus({
    totalVerifications,
    evidencesCount: evidences,
    trustScore,
  });

  const experiencesFromEmployment = employmentRows.map((record: any) => {
    const linkedVerificationId = String(record?.last_verification_request_id || "");
    const linkedVerification =
      verificationRequestById.get(linkedVerificationId) || verificationById.get(linkedVerificationId);
    const recordStatus = normalizeEmploymentRecordVerificationStatus(record?.verification_status || null);
    const summaryStatusRaw = String(linkedVerification?.status_effective || linkedVerification?.status || "").trim();
    const statusText =
      recordStatus === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED
        ? EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED
        : recordStatus === EMPLOYMENT_RECORD_VERIFICATION_STATUS.REJECTED
          ? EMPLOYMENT_RECORD_VERIFICATION_STATUS.REJECTED
          : summaryStatusRaw || recordStatus;
    const score = Number(linkedVerification?.score ?? 0);
    const evidenceCount = Number(
      linkedVerification?.evidence_count ?? linkedVerification?.evidences_count ?? 0
    );
    const reuseCount = Number(linkedVerification?.reuse_count ?? 0);
    return {
      experience_id: String(record?.id || ""),
      linked_verification_id: linkedVerificationId || null,
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
    linked_verification_id: String(row?.verification_id || `fallback-${index}`),
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

  const verificationEntries: Array<[string, any]> = [
    ...(rows || []).map((x: any) => [String(x?.verification_id || ""), x] as [string, any]),
    ...asArray(verificationRequests).map((x: any) => [String(x?.id || ""), x] as [string, any]),
  ];
  const verificationsById = new Map<string, any>(verificationEntries);
  const experiencesEnriched = experiences.map((item: any) => {
    const verificationId = String(item?.linked_verification_id || item?.experience_id || "");
    const linkedVerification = verificationsById.get(verificationId) || null;
    const linkedEvidences = evidenceByVerification.get(verificationId) || [];
    const badges = new Set<string>();
    const method = String(linkedVerification?.verification_channel || "").toLowerCase();
    const status = String(item?.status_text || "").toLowerCase();
    const normalizedEmploymentStatus = normalizeEmploymentRecordVerificationStatus(status);
    if (status === "verified" || status === "approved" || normalizedEmploymentStatus === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED) {
      badges.add(isDocumentaryOfficialVerification(linkedVerification) ? "Vida laboral" : "Verificación empresa");
    }
    if (method === "documentary" && !isDocumentaryOfficialVerification(linkedVerification)) badges.add("Documental");
    if (method === "peer") badges.add("Peer");
    for (const ev of linkedEvidences) {
      const b = toEvidenceVerificationBadge((ev as any)?.document_type || (ev as any)?.evidence_type);
      if (b) badges.add(b);
    }
    if (!badges.size && Number(item?.evidence_count || 0) > 0) badges.add("Documental");
    return {
      ...item,
      verification_method: method || null,
      verification_badges: Array.from(badges),
      is_verified:
        status === "verified" ||
        status === "approved" ||
        normalizedEmploymentStatus === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED,
    };
  });

  const educationItems = candidateCollections.education.map((item: any) => ({
    id: String(item?.id || ""),
    title: asText(item?.title || item?.degree_name || item?.program, 180) || "Formación",
    institution: asText(item?.institution || item?.institution_name, 180) || null,
    start_date: asText(item?.start_date, 30) || null,
    end_date: asText(item?.end_date, 30) || null,
    description: asText(item?.description, 500) || null,
  }));

  const achievementItems = [
    ...candidateCollections.certifications.map((item: any) => formatAchievementEntry({
      title: item?.name,
      issuer: item?.issuer,
      date: item?.issue_date,
      description: item?.notes,
      category: "certificacion",
    })),
    ...candidateCollections.achievements.map((item: any) => formatAchievementEntry({
      title: item?.title,
      issuer: item?.issuer,
      date: item?.achieved_at,
      description: item?.description,
      category: item?.achievement_type || "otro",
    })),
  ]
    .filter(Boolean);
  const publicLanguages = normalizePublicLanguages(candidateCollections.language_labels);

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
  const publicName = toPublicName(profileFullName);
  const profileTitle = asText((profile as any)?.title, 140) || null;
  const profileLocation = asText((profile as any)?.location, 140) || null;
  const profileSummary = asText(candidateProfile?.summary, 1200) || null;
  const availability = mapCandidateAvailability(candidateProfile?.job_search_status) || null;
  const workMode = asText(candidateProfile?.preferred_workday, 80) || null;
  const sector = asText(asArray(candidateProfile?.preferred_roles)?.[0], 120) || null;
  const candidateCapabilities = getCandidatePlanCapabilities(latestSub?.plan || "free");
  const teaser = {
    full_name: internalPreviewAllowed ? profileFullName : publicName,
    public_name: publicName,
    title: profileTitle,
    location: profileLocation,
    languages: internalPreviewAllowed ? publicLanguages : [],
    summary: internalPreviewAllowed ? profileSummary : null,
    trust_score: trustScore,
    trust_score_breakdown: normalizedTrustBreakdown.display,
    trust_score_components: normalizedTrustBreakdown.display,
    experiences_total: rows.length,
    verified_experiences: publicVerifiedExperienceCount,
    confirmed_experiences: confirmed,
    evidences_total: evidences,
    evidences_count: evidences,
    reuse_total: Number(legacyTrustBreakdown.reuseEvents ?? 0),
    reuse_companies: Number(legacyTrustBreakdown.reuseCompanies ?? 0),
    education_total: internalPreviewAllowed ? educationTotal : 0,
    achievements_total: internalPreviewAllowed ? candidateCollections.achievements_catalog.all.length : 0,
    verified_work_count: verifiedWork,
    verified_education_count: internalPreviewAllowed ? verifiedEducation : 0,
    total_verifications: totalVerifications,
    profile_status: profileStatus,
    profile_visibility: "public_link",
    lifecycle_status: lifecycleStatus,
    subscription_plan: latestSub?.plan || "free",
    subscription_status: normalizeSubscriptionStatus(latestSub?.status),
    qr_enabled: candidateCapabilities.canShareByQr,
    cv_download_enabled: candidateCapabilities.canDownloadVerifiedCv,
    latest_verification_at:
      verifiedRows
        .map((row: any) => row?.resolved_at || row?.created_at || null)
        .find(Boolean) || null,
    featured_verified_experiences: internalPreviewAllowed
      ? experiencesEnriched
          .filter((item: any) => Boolean(item?.is_verified))
          .slice(0, 3)
          .map((item: any) => ({
            position: asText(item?.position, 120) || "Experiencia verificada",
            company_name: asText(item?.company_name, 120) || null,
            verification_badges: Array.isArray(item?.verification_badges) ? item.verification_badges.slice(0, 2) : [],
          }))
      : [],
    availability,
    work_mode: internalPreviewAllowed ? workMode : null,
    sector: internalPreviewAllowed ? sector : null,
  };

  return json(200, {
    route_version: "public-candidate-token-v1",
    token: linkResolved.token,
    candidate_id: candidateId,
    teaser,
    experiences: internalPreviewAllowed ? experiencesEnriched : [],
    education: internalPreviewAllowed ? educationItems : [],
    recommendations: internalPreviewAllowed ? derivedRecommendations : [],
    achievements: internalPreviewAllowed ? achievementItems : [],
    verified_skills: verifiedSkills,
    candidate_public_profile: {
      identity: {
        candidate_id: candidateId,
        full_name: internalPreviewAllowed ? profileFullName : publicName,
      },
      headline: profileTitle,
      location: profileLocation,
      languages: internalPreviewAllowed ? publicLanguages : [],
      education: internalPreviewAllowed ? educationItems : [],
      experiences: internalPreviewAllowed ? experiencesEnriched : [],
      verifications: {
        total: totalVerifications,
        verified_work_count: Math.max(verifiedWork, verifiedEmploymentFromRecords),
        verified_education_count: internalPreviewAllowed ? verifiedEducation : 0,
        confirmed_experiences: confirmed,
        evidences_total: evidences,
      },
      trust_score: {
        value: trustScore,
      },
      recommendations: internalPreviewAllowed ? derivedRecommendations : [],
      skills: verifiedSkills,
    },
  });
}
