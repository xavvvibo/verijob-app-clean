import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { sanitizePublic } from "@/utils/sanitizePublic";
import { normalizeCandidatePublicToken, resolveActiveCandidatePublicLink } from "@/lib/public/candidate-public-link";
import { isUnavailableLifecycleStatus } from "@/lib/account/lifecycle";
import { resolveSafeCandidateName } from "@/lib/company-candidate-import-shared";
import {
  deriveCompanyCandidateAccess,
  resolveCompanyCandidateAccess,
} from "@/lib/company/profile-access";
import { resolveCompanyProfileAccessCredits } from "@/lib/company/profile-access-credits";
import { readCandidateProfileCollections } from "@/lib/candidate/profile-collections";
import { toExperienceVerificationBadgeLabels } from "@/lib/candidate/experience-verification-badges";
import { getTrustBreakdownLegacyCompat, normalizeTrustBreakdown } from "@/lib/trust/trust-model";

type Params = { token: string };

export const runtime = "nodejs";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function logCompanyCandidateResponse(event: string, payload: Record<string, unknown>) {
  console.log("[company-candidate-token]", event, payload);
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

function resolveProfileStatus(args: { totalVerifications: number; evidencesCount: number; trustScore: number }) {
  if (args.totalVerifications === 0 && args.evidencesCount === 0) return "reviewing";
  if (args.totalVerifications >= 3 || args.trustScore >= 80) return "verified";
  return "partially_verified";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildFullAccessPayload(args: {
  candidateId: string;
  snapshot: any;
  access: any;
  safe: any;
  contact: any;
  availability: any;
  credibility: any;
  trustComponents: any;
  verificationTimeline: any[];
  gate: any;
  unlocked: boolean;
  accessConsumed: boolean;
}) {
  return {
    candidate_id: args.candidateId,
    view_mode: "full",
    unlocked: args.unlocked,
    access_consumed: args.accessConsumed,
    credits_remaining: args.gate?.credits_remaining ?? null,
    preview: args.snapshot,
    access: args.access,
    profile: args.safe,
    contact: args.contact,
    availability: args.availability,
    credibility: args.credibility,
    trust_components: args.trustComponents,
    verification_timeline: args.verificationTimeline,
    gate: {
      allowed: true,
      consumed: !!args.gate?.consumed,
      requires_overage: !!args.gate?.requires_overage,
      overage_price: args.gate?.overage_price ?? null,
      credits_remaining: args.gate?.credits_remaining ?? null,
      period_start: args.gate?.period_start ?? null,
    },
  };
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

function buildInvitePreviewPayload(inviteRow: any) {
  const extractedPayload =
    inviteRow?.extracted_payload_json && typeof inviteRow.extracted_payload_json === "object"
      ? inviteRow.extracted_payload_json
      : {};
  const extractedLanguages = Array.isArray(extractedPayload?.languages)
    ? extractedPayload.languages
        .map((item: any) => String(item?.name || item?.language || item?.title || item || "").trim())
        .filter(Boolean)
    : [];

  return {
    public_name: resolveSafeCandidateName(inviteRow?.candidate_name_raw, inviteRow?.candidate_email),
    sector: String(inviteRow?.target_role || extractedPayload?.headline || "").trim() || null,
    years_experience: Array.isArray(extractedPayload?.experiences) ? extractedPayload.experiences.length : null,
    approximate_location: String(extractedPayload?.location || extractedPayload?.experiences?.[0]?.location || "").trim() || null,
    experiences_detected: Array.isArray(extractedPayload?.experiences) ? extractedPayload.experiences.length : 0,
    total_verifications: 0,
    approved_verifications: 0,
    verification_types: [],
    verification_breakdown: { email_or_company: 0, documental: 0 },
    languages_detected: extractedLanguages,
    trust_score: null,
    onboarding_completion: 25,
    onboarding_status: "candidate_pending_acceptance",
    profile_state: "en_construccion",
    last_activity_at: inviteRow?.updated_at || inviteRow?.accepted_at || inviteRow?.created_at || null,
  };
}

function yearsFromVerificationRows(rows: any[]) {
  const dates = rows
    .flatMap((row: any) => [row?.start_date || null, row?.end_date || null])
    .filter(Boolean)
    .map((value: any) => Date.parse(String(value)));
  const valid = dates.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid, Date.now());
  const years = Math.max(0, Math.round(((max - min) / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10);
  return years > 0 ? Math.round(years) : null;
}

function yearsFromExperienceRows(rows: any[]) {
  const dates = rows
    .flatMap((row: any) => [row?.start_date || null, row?.end_date || null])
    .filter(Boolean)
    .map((value: any) => Date.parse(String(value)));
  const valid = dates.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid, Date.now());
  const years = Math.max(0, Math.round(((max - min) / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10);
  return years > 0 ? Math.round(years) : null;
}

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { token: tokenParam } = await ctx.params;
  const normalizedToken = normalizeCandidatePublicToken(tokenParam);
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "full" ? "full" : "preview";
  logCompanyCandidateResponse("request", { token: tokenParam, mode });

  // Auth (empresa logueada)
  const supabase = await createClient();
  const { data: au, error: auErr } = await supabase.auth.getUser();
  if (auErr || !au?.user) return json(401, { error: "Unauthorized" });

  // Guard estricto: solo contexto empresa autenticada
  const { data: requesterProfile, error: requesterErr } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", au.user.id)
    .maybeSingle();
  if (requesterErr) return json(400, { error: "Profile read failed", details: requesterErr.message });
  if (!(requesterProfile as any)?.active_company_id) return json(403, { error: "Company context required" });

  // Resolver token con service role (no dependemos de RLS del link)
  const service = createServiceRoleClient();
  const activeCompanyId = String((requesterProfile as any)?.active_company_id || "");

  const linkResolved = await resolveActiveCandidatePublicLink(service, normalizedToken);
  let link = linkResolved.ok ? linkResolved.link : null;
  let unresolvedInvitePreview: any = null;

  if (linkResolved.ok === false) {
    const [directLinkRes, inviteRes] = await Promise.all([
      service
        .from("candidate_public_links")
        .select("id,candidate_id,expires_at,is_active,created_at")
        .eq("public_token", normalizedToken)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      service
        .from("company_candidate_import_invites")
        .select("id,linked_user_id,candidate_name_raw,candidate_email,target_role,created_at,updated_at,accepted_at,parse_status,status,extracted_payload_json")
        .eq("company_id", activeCompanyId)
        .eq("invite_token", normalizedToken)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const directLink = directLinkRes.data as any;
    const inviteRow = inviteRes.data as any;
    const inviteLinkUserId = String(inviteRow?.linked_user_id || "").trim();

    if (directLink?.candidate_id) {
      // Si el token existió realmente en candidate_public_links, debe seguir resolviendo al candidato.
      // No forzamos dependencia con company_candidate_import_invites porque el acceso empresa puede seguir
      // siendo válido aunque el token ya no sea el link activo o no provenga de un import invite.
      link = {
        id: String(directLink.id || ""),
        candidate_id: String(directLink.candidate_id),
        expires_at: directLink.expires_at || null,
        is_active: directLink.is_active ?? null,
      };
    } else if (inviteLinkUserId) {
      link = {
        id: "",
        candidate_id: inviteLinkUserId,
        expires_at: null,
        is_active: true,
      };
    } else if (inviteRow?.id) {
      unresolvedInvitePreview = inviteRow;
    }

    if (!link) {
      if (unresolvedInvitePreview?.id) {
        const previewBody = {
          candidate_id: null,
          view_mode: "preview",
          preview: buildInvitePreviewPayload(unresolvedInvitePreview),
          access: {
            access_status: "never",
            access_granted_at: null,
            access_expires_at: null,
            source: null,
          },
          gate: {
            allowed: true,
            consumed: false,
            requires_overage: false,
            credits_remaining: 0,
          },
        };
        if (mode === "full") {
          logCompanyCandidateResponse("return:invite-preview-instead-of-full", {
            mode,
            body: previewBody,
          });
          return json(409, {
            error: "candidate_profile_incomplete",
            user_message: "Este candidato todavía no tiene un perfil completo desbloqueable.",
            ...previewBody,
          });
        }
        logCompanyCandidateResponse("return:preview", { mode, body: previewBody });
        return json(200, previewBody);
      }
      if (linkResolved.reason === "expired") return json(410, { error: "Link expired" });
      return json(404, { error: "Not found" });
    }
  }

  const { data: profile } = await service
    .from("profiles")
    .select("*,lifecycle_status,deleted_at")
    .eq("id", link.candidate_id)
    .maybeSingle();

  if (!profile) {
    const inviteByLinkedUserRes = await service
      .from("company_candidate_import_invites")
      .select("id,linked_user_id,candidate_name_raw,candidate_email,target_role,created_at,updated_at,accepted_at,parse_status,status,extracted_payload_json")
      .eq("company_id", activeCompanyId)
      .eq("linked_user_id", link.candidate_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const inviteByLinkedUser = inviteByLinkedUserRes.data as any;
    if (inviteByLinkedUser?.id) {
      const access = activeCompanyId
        ? await resolveCompanyCandidateAccess({
            service,
            companyId: activeCompanyId,
            candidateId: String(link.candidate_id),
          })
        : deriveCompanyCandidateAccess(null, null);
      const profileAccessCredits = activeCompanyId
        ? await resolveCompanyProfileAccessCredits({
            service,
            userId: au.user.id,
            companyId: activeCompanyId,
          })
        : { available: 0 };

      const previewBody = {
        candidate_id: link.candidate_id,
        view_mode: "preview",
        preview: buildInvitePreviewPayload(inviteByLinkedUser),
        access,
        gate: {
          allowed: true,
          consumed: false,
          requires_overage: false,
          credits_remaining: profileAccessCredits.available,
        },
      };

      if (mode === "full") {
        logCompanyCandidateResponse("return:linked-invite-preview-instead-of-full", {
          mode,
          candidate_id: link.candidate_id,
          access_status: access?.access_status ?? null,
          body: previewBody,
        });
        return json(409, {
          error: "candidate_profile_incomplete",
          user_message: "Este candidato todavía no tiene un perfil completo desbloqueable.",
          ...previewBody,
        });
      }

      logCompanyCandidateResponse("return:preview-with-linked-invite", {
        mode,
        candidate_id: link.candidate_id,
        access_status: access?.access_status ?? null,
        body: previewBody,
      });
      return json(200, previewBody);
    }

    return json(404, { error: "Not found" });
  }
  const lifecycleStatus = String((profile as any)?.lifecycle_status || "active").toLowerCase();
  if (isUnavailableLifecycleStatus(lifecycleStatus)) {
    return json(410, { error: "Profile unavailable" });
  }

  const { data: candidateProfile } = await service
    .from("candidate_profiles")
    .select("allow_company_email_contact,allow_company_phone_contact,job_search_status,availability_start,preferred_workday,preferred_roles,work_zones,availability_schedule,trust_score,trust_score_breakdown,raw_cv_json,profile_ready_for_company_access,profile_ready_reason")
    .eq("user_id", link.candidate_id)
    .maybeSingle();
  const candidateCollections = await readCandidateProfileCollections(service, String(link.candidate_id), { candidateProfile });

  const profileReadyForCompanyAccess = Boolean((candidateProfile as any)?.profile_ready_for_company_access);
  const profileReadyReason = String((candidateProfile as any)?.profile_ready_reason || "").trim() || "verification_pending";

  if (mode === "full" && !profileReadyForCompanyAccess) {
    return json(409, {
      error: "candidate_profile_incomplete",
      user_message: "El perfil todavía no está listo para desbloqueo. No se ha consumido ningún acceso.",
      candidate_id: link.candidate_id,
      view_mode: "preview",
      unlocked: false,
      access_consumed: false,
      profile_ready_for_company_access: false,
      profile_ready_reason: profileReadyReason,
      gate: {
        allowed: false,
        consumed: false,
        requires_overage: false,
        overage_price: null,
        credits_remaining: null,
        period_start: null,
      },
    });
  }

  const { data: verifications } = await service
    .from("verification_summary")
    .select("*")
    .eq("candidate_id", link.candidate_id);

  const verificationRows = Array.isArray(verifications) ? verifications : [];
  const verificationIds = Array.from(
    new Set(
      verificationRows
        .map((row: any) => String(row?.verification_id || "").trim())
        .filter(Boolean),
    ),
  );

  const [verificationRequestsRes, evidenceRowsRes] = await Promise.all([
    verificationIds.length
      ? service
          .from("verification_requests")
          .select("id,status,verification_channel,request_context,company_confirmed")
          .in("id", verificationIds as string[])
      : Promise.resolve({ data: [], error: null } as any),
    verificationIds.length
      ? service
          .from("evidences")
          .select("verification_request_id,document_type,evidence_type")
          .in("verification_request_id", verificationIds as string[])
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const [experienceCountRes, employmentRowsRes, linkedInviteRes] = await Promise.all([
    service
      .from("profile_experiences")
      .select("id,start_date,end_date,location,role_title,company_name,created_at")
      .eq("user_id", link.candidate_id),
    service
      .from("employment_records")
      .select("id,start_date,end_date,position,company_name_freeform")
      .eq("candidate_id", link.candidate_id),
    service
      .from("company_candidate_import_invites")
      .select("id,status,accepted_at,updated_at,target_role,candidate_name_raw,candidate_email,extracted_payload_json")
      .eq("company_id", activeCompanyId)
      .eq("linked_user_id", link.candidate_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const lastActivityAt =
    (linkedInviteRes.data as any)?.updated_at ||
    (linkedInviteRes.data as any)?.accepted_at ||
    (candidateProfile as any)?.raw_cv_json?.company_cv_import?.imported_at ||
    null;

  if (link.id) {
    await service
      .from("candidate_public_links")
      .update({ last_viewed_at: new Date().toISOString() })
      .eq("id", link.id);
  }

  const safe = sanitizePublic(profile);
  const maskedName = toPublicName((safe as any)?.full_name || (safe as any)?.name);
  (safe as any).full_name = maskedName;
  (safe as any).name = maskedName;
  const rawEmail =
    typeof (profile as any)?.email === "string" && (profile as any).email.trim()
      ? String((profile as any).email).trim()
      : null;
  const rawPhone = [
    (profile as any)?.phone,
    (profile as any)?.phone_number,
    (profile as any)?.mobile,
    (profile as any)?.telefono,
    (profile as any)?.tel,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .find((v) => !!v) || null;

  const allowEmail = !!(candidateProfile as any)?.allow_company_email_contact;
  const allowPhone = !!(candidateProfile as any)?.allow_company_phone_contact;
  const contact = {
    email: allowEmail ? rawEmail : null,
    phone: allowPhone ? rawPhone : null,
    permissions: {
      allow_company_email_contact: allowEmail,
      allow_company_phone_contact: allowPhone,
    },
  };
  const availability = {
    job_search_status: (candidateProfile as any)?.job_search_status ?? null,
    availability_start: (candidateProfile as any)?.availability_start ?? null,
    preferred_workday: (candidateProfile as any)?.preferred_workday ?? null,
    preferred_roles: Array.isArray((candidateProfile as any)?.preferred_roles)
      ? (candidateProfile as any).preferred_roles
      : [],
    work_zones: (candidateProfile as any)?.work_zones ?? null,
    availability_schedule: Array.isArray((candidateProfile as any)?.availability_schedule)
      ? (candidateProfile as any).availability_schedule
      : [],
  };
  const verificationRequestById = new Map<string, any>();
  for (const row of Array.isArray(verificationRequestsRes.data) ? verificationRequestsRes.data : []) {
    const id = String((row as any)?.id || "").trim();
    if (id) verificationRequestById.set(id, row);
  }
  const evidenceByVerification = new Map<string, any[]>();
  for (const row of Array.isArray(evidenceRowsRes.data) ? evidenceRowsRes.data : []) {
    const id = String((row as any)?.verification_request_id || "").trim();
    if (!id) continue;
    const current = evidenceByVerification.get(id) || [];
    current.push(row);
    evidenceByVerification.set(id, current);
  }

  const verifiedRows = verificationRows.filter((r: any) => isVerifiedStatus(r?.status));
  const verifiedWorkCount = verifiedRows.filter((r: any) => !isEducationVerification(r)).length;
  const verifiedEducationCount = verifiedRows.filter((r: any) => isEducationVerification(r)).length;
  const totalVerifications = verifiedWorkCount + verifiedEducationCount;
  const evidencesCount = verificationRows.reduce(
    (acc: number, r: any) => acc + Number(r?.evidence_count ?? r?.evidences_count ?? 0),
    0
  );
  const trustScore = Number((candidateProfile as any)?.trust_score ?? 0);
  const normalizedTrustBreakdown = normalizeTrustBreakdown((candidateProfile as any)?.trust_score_breakdown);
  const legacyTrustBreakdown = getTrustBreakdownLegacyCompat((candidateProfile as any)?.trust_score_breakdown);
  const profileStatus = resolveProfileStatus({
    totalVerifications,
    evidencesCount,
    trustScore,
  });
  const credibility = {
    verified_work_count: verifiedWorkCount,
    verified_education_count: verifiedEducationCount,
    total_verifications: totalVerifications,
    evidences_count: evidencesCount,
    trust_score: trustScore,
    profile_status: profileStatus,
  };
  const profileExperienceRows = Array.isArray(experienceCountRes.data) ? experienceCountRes.data : [];
  const employmentRows = Array.isArray(employmentRowsRes.data) ? employmentRowsRes.data : [];
  const experienceRows =
    profileExperienceRows.length > 0
      ? profileExperienceRows
      : employmentRows.map((row: any) => ({
          id: row?.id,
          start_date: row?.start_date,
          end_date: row?.end_date,
          location: null,
          role_title: row?.position,
          company_name: row?.company_name_freeform,
          created_at: null,
        }));
  const experienceCount = Math.max(profileExperienceRows.length, employmentRows.length);
  const profileLanguages = candidateCollections.language_labels;
  const importedLanguages = Array.isArray((candidateProfile as any)?.raw_cv_json?.company_cv_import?.extracted_payload?.languages)
    ? (candidateProfile as any).raw_cv_json.company_cv_import.extracted_payload.languages
        .map((item: any) => String(item?.name || item?.language || item?.title || item || "").trim())
        .filter(Boolean)
    : [];
  const invitePayload =
    linkedInviteRes.data && typeof (linkedInviteRes.data as any)?.extracted_payload_json === "object"
      ? (linkedInviteRes.data as any).extracted_payload_json
      : {};
  const languagesDetected = Array.from(new Set([...profileLanguages, ...importedLanguages]));
  const verificationTypes = Array.from(
    new Set(
      verificationRows.flatMap((row: any) => {
        const badges = new Set<string>();
        const method = String(row?.verification_channel || "").toLowerCase();
        const status = String(row?.status_effective || row?.status || "").toLowerCase();
        if (status === "verified" || status === "approved" || !!row?.company_confirmed) badges.add("empresa");
        if (method === "documentary" || Number(row?.evidence_count ?? row?.evidences_count ?? 0) > 0) badges.add("documental");
        if (method === "email") badges.add("email");
        return Array.from(badges);
      })
    )
  );
  const verificationBreakdown = {
    email_or_company: verificationRows.filter((row: any) => {
      const method = String(row?.verification_channel || "").toLowerCase();
      return method === "email" || !!row?.company_confirmed || isVerifiedStatus(row?.status);
    }).length,
    documental: verificationRows.filter((row: any) => {
      const method = String(row?.verification_channel || "").toLowerCase();
      return method === "documentary" || Number(row?.evidence_count ?? row?.evidences_count ?? 0) > 0;
    }).length,
  };
  const completionSignals = [
    Number(Boolean((profile as any)?.full_name)),
    Number(Boolean((profile as any)?.title)),
    Number(Boolean((profile as any)?.location)),
    Number(experienceCount > 0),
    Number(candidateCollections.education.length > 0),
    Number(languagesDetected.length > 0),
  ];
  const onboardingCompletion = clampPercent(
    (completionSignals.reduce((acc, value) => acc + value, 0) / Math.max(1, completionSignals.length)) * 100
  );
  const importStatus = String((linkedInviteRes.data as any)?.status || "").toLowerCase();
  const hasUnlockableProfileSignals =
    experienceCount > 0 ||
    employmentRows.length > 0 ||
    totalVerifications > 0 ||
    trustScore > 0 ||
    candidateCollections.education.length > 0 ||
    languagesDetected.length > 0 ||
    Boolean((profile as any)?.title) ||
    Boolean((profile as any)?.location);
  const companyImportInProgress =
    importStatus === "emailed" ||
    importStatus === "uploaded" ||
    (importStatus === "accepted" && !hasUnlockableProfileSignals && onboardingCompletion < 70);
  const profileState =
    companyImportInProgress
      ? "en_construccion"
      : lastActivityAt && Date.now() - Date.parse(String(lastActivityAt)) < 7 * 24 * 60 * 60 * 1000
        ? "actualizado_recientemente"
        : "listo_para_ver";
  const snapshot = {
    public_name: toPublicName((profile as any)?.full_name),
    sector:
      String(
        (Array.isArray((candidateProfile as any)?.preferred_roles) ? (candidateProfile as any)?.preferred_roles?.[0] : "") ||
          (profile as any)?.title ||
          (linkedInviteRes.data as any)?.target_role ||
          invitePayload?.headline ||
          ""
      ).trim() || null,
    years_experience:
      yearsFromExperienceRows(experienceRows) ||
      yearsFromVerificationRows(verificationRows) ||
      (Array.isArray(invitePayload?.experiences) ? invitePayload.experiences.length : null),
    approximate_location:
      String(
        (profile as any)?.location ||
          (candidateProfile as any)?.work_zones ||
          experienceRows.find((row: any) => String(row?.location || "").trim())?.location ||
          invitePayload?.location ||
          invitePayload?.experiences?.[0]?.location ||
          ""
      ).trim() || null,
    experiences_detected: experienceCount,
    total_verifications: totalVerifications,
    approved_verifications: verifiedRows.length,
    verification_types: verificationTypes,
    verification_breakdown: verificationBreakdown,
    languages_detected: languagesDetected,
    trust_score: trustScore,
    trust_score_breakdown: normalizedTrustBreakdown.display,
    reuse_total: Number(legacyTrustBreakdown.reuseEvents ?? 0),
    onboarding_completion: onboardingCompletion,
    onboarding_status: companyImportInProgress ? "candidate_onboarding_in_progress" : "ready",
    profile_state: profileState,
    last_activity_at: lastActivityAt,
  };

  const companyId = String((requesterProfile as any)?.active_company_id || "").trim();
  const profileAccessCredits = companyId
    ? await resolveCompanyProfileAccessCredits({
        service,
        userId: au.user.id,
        companyId,
      })
    : { available: 0 };
  const access = companyId
    ? await resolveCompanyCandidateAccess({
        service,
        companyId,
        candidateId: String(link.candidate_id),
      })
    : deriveCompanyCandidateAccess(null, null);

  if (mode === "preview") {
    const previewBody = {
      candidate_id: link.candidate_id,
      view_mode: "preview",
      preview: snapshot,
      access,
      gate: {
        allowed: true,
        consumed: false,
        requires_overage: false,
        credits_remaining: profileAccessCredits.available,
      },
    };
    logCompanyCandidateResponse("return:preview", {
      mode,
      candidate_id: link.candidate_id,
      access_status: access?.access_status ?? null,
      body: previewBody,
    });
    return json(200, previewBody);
  }

  if (companyImportInProgress) {
    return json(409, {
      error: "candidate_profile_incomplete",
      user_message: "Este candidato aún está completando su perfil verificable. Recibirás una notificación cuando esté disponible.",
      preview: snapshot,
      access,
      upgrade_url: "/company/subscription",
    });
  }

  let gate: any = {
    allowed: true,
    consumed: false,
    requires_overage: false,
    overage_price: null,
    credits_remaining: null,
    period_start: null,
  };
  let resolvedAccess = access;
  let accessConsumed = false;

  if (access.access_status !== "active") {
    gate = {
      ...gate,
      allowed: false,
      consumed: false,
      credits_remaining: profileAccessCredits.available,
    };
    return json(402, {
      error: "profile_locked",
      user_message: "Primero desbloquea el perfil completo para tu empresa.",
      reason: profileAccessCredits.available > 0 ? "unlock_required" : "no_credits",
      credits_remaining: profileAccessCredits.available,
      upgrade_url: "/company/upgrade",
      preview: snapshot,
      access,
    });
  } else {
    gate = {
      ...gate,
      allowed: true,
      consumed: false,
      credits_remaining: profileAccessCredits.available,
    };
    accessConsumed = false;
  }

  const trustComponents = {
    documentary: normalizedTrustBreakdown.display.documentary,
    company: normalizedTrustBreakdown.display.company,
    peer: normalizedTrustBreakdown.display.peer,
    reuse: normalizedTrustBreakdown.display.reuse,
    cvConsistency: normalizedTrustBreakdown.display.cvConsistency,
    verification: normalizedTrustBreakdown.legacy.verification,
    evidence: normalizedTrustBreakdown.legacy.evidence,
    consistency: normalizedTrustBreakdown.legacy.consistency,
  };
  const verificationTimeline = verificationRows
    .map((row: any) => {
      const verificationId = String(row?.verification_id || "").trim();
      const requestRow = verificationRequestById.get(verificationId) || null;
      const evidenceRows = evidenceByVerification.get(verificationId) || [];
      return {
        verification_id: verificationId,
        position: row?.position || null,
        company_name: row?.company_name || row?.company_name_target || null,
        status: String(row?.status_effective || row?.status || "unknown"),
        evidence_count: Number(row?.evidence_count ?? row?.evidences_count ?? 0),
        reuse_count: Number(row?.reuse_count ?? 0),
        start_date: row?.start_date || null,
        end_date: row?.end_date || null,
        created_at: row?.created_at || null,
        resolved_at: row?.resolved_at || null,
        verification_badges: toExperienceVerificationBadgeLabels({
          verificationChannel: requestRow?.verification_channel || row?.verification_channel,
          verificationStatus: row?.status_effective || row?.status,
          companyConfirmed: requestRow?.company_confirmed ?? row?.company_confirmed,
          evidenceCount: row?.evidence_count ?? row?.evidences_count,
          documentType: row?.document_type,
          evidenceType: row?.evidence_type,
          requestContext: requestRow?.request_context || row?.request_context,
          evidences: evidenceRows,
        }),
      };
    })
    .sort((a, b) => {
      const ta = Date.parse(String(a.resolved_at || a.created_at || 0));
      const tb = Date.parse(String(b.resolved_at || b.created_at || 0));
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    })
    .slice(0, 12);

  const fullBody = buildFullAccessPayload({
    candidateId: link.candidate_id,
    snapshot,
    access: resolvedAccess,
    safe,
    contact,
    availability,
    credibility,
    trustComponents,
    verificationTimeline,
    gate: {
      ...gate,
      credits_remaining: gate?.credits_remaining ?? profileAccessCredits.available,
    },
    unlocked: resolvedAccess.access_status === "active",
    accessConsumed: accessConsumed || !!gate?.consumed,
  });
  logCompanyCandidateResponse("return:full", {
    mode,
    candidate_id: link.candidate_id,
    access_status_after: resolvedAccess?.access_status ?? null,
    body: {
      view_mode: fullBody.view_mode,
      unlocked: fullBody.unlocked,
      access_consumed: fullBody.access_consumed,
      credits_remaining: fullBody.credits_remaining,
      access_status: fullBody.access?.access_status ?? null,
    },
  });
  return json(200, fullBody);
}
