import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { sanitizePublic } from "@/utils/sanitizePublic";
import { resolveActiveCandidatePublicLink } from "@/lib/public/candidate-public-link";
import { isUnavailableLifecycleStatus } from "@/lib/account/lifecycle";
import {
  deriveCompanyCandidateAccess,
  resolveCompanyCandidateAccess,
} from "@/lib/company/profile-access";

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

function resolveProfileStatus(args: { totalVerifications: number; evidencesCount: number; trustScore: number }) {
  if (args.totalVerifications === 0 && args.evidencesCount === 0) return "reviewing";
  if (args.totalVerifications >= 3 || args.trustScore >= 80) return "verified";
  return "partially_verified";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
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

async function resolveConsumptionSource(args: {
  service: ReturnType<typeof createServiceRoleClient>;
  companyId: string;
  viewerUserId: string;
}) {
  const latestPurchase = await args.service
    .from("stripe_oneoff_purchases")
    .select("product_key,created_at")
    .eq("company_id", args.companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const purchaseKey = String((latestPurchase.data as any)?.product_key || "").trim().toLowerCase();
  if (purchaseKey === "company_single_cv") return "single_unlock";
  if (purchaseKey === "company_pack_5") return "pack_credit";

  const latestGrant = await args.service
    .from("credit_grants")
    .select("source_type,metadata,created_at")
    .eq("user_id", args.viewerUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sourceType = String((latestGrant.data as any)?.source_type || "").trim().toLowerCase();
  const productKey = String((latestGrant.data as any)?.metadata?.product_key || "").trim().toLowerCase();
  if (productKey === "company_single_cv") return "single_unlock";
  if (productKey === "company_pack_5") return "pack_credit";
  if (sourceType.includes("promo")) return "promo";
  return "grant";
}

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { token: tokenParam } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "full" ? "full" : "preview";

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

  const linkResolved = await resolveActiveCandidatePublicLink(service, tokenParam);
  if (linkResolved.ok === false) {
    if (linkResolved.reason === "expired") return json(410, { error: "Link expired" });
    return json(404, { error: "Not found" });
  }
  const link = linkResolved.link;

  const { data: profile } = await service
    .from("profiles")
    .select("*,lifecycle_status,deleted_at")
    .eq("id", link.candidate_id)
    .maybeSingle();

  if (!profile) return json(404, { error: "Not found" });
  const lifecycleStatus = String((profile as any)?.lifecycle_status || "active").toLowerCase();
  if (isUnavailableLifecycleStatus(lifecycleStatus)) {
    return json(410, { error: "Profile unavailable" });
  }

  const { data: candidateProfile } = await service
    .from("candidate_profiles")
    .select("allow_company_email_contact,allow_company_phone_contact,job_search_status,availability_start,preferred_workday,preferred_roles,work_zones,availability_schedule,trust_score,trust_score_breakdown,education,achievements,raw_cv_json")
    .eq("user_id", link.candidate_id)
    .maybeSingle();

  const { data: verifications } = await service
    .from("verification_summary")
    .select("*")
    .eq("candidate_id", link.candidate_id);

  const [experienceCountRes, linkedInviteRes] = await Promise.all([
    service.from("profile_experiences").select("id", { count: "exact", head: true }).eq("user_id", link.candidate_id),
    service
      .from("company_candidate_import_invites")
      .select("id,status,accepted_at,updated_at")
      .eq("company_id", String((requesterProfile as any)?.active_company_id || ""))
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

  await service
    .from("candidate_public_links")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", link.id);

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
  const verificationRows = Array.isArray(verifications) ? verifications : [];
  const verifiedRows = verificationRows.filter((r: any) => isVerifiedStatus(r?.status));
  const verifiedWorkCount = verifiedRows.filter((r: any) => !isEducationVerification(r)).length;
  const verifiedEducationCount = verifiedRows.filter((r: any) => isEducationVerification(r)).length;
  const totalVerifications = verifiedWorkCount + verifiedEducationCount;
  const evidencesCount = verificationRows.reduce(
    (acc: number, r: any) => acc + Number(r?.evidence_count ?? r?.evidences_count ?? 0),
    0
  );
  const trustScore = Number((candidateProfile as any)?.trust_score ?? 0);
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
  const breakdownRaw = (candidateProfile as any)?.trust_score_breakdown || {};
  const experienceCount = Number(experienceCountRes.count || 0);
  const profileLanguages = Array.isArray((profile as any)?.languages)
    ? (profile as any).languages.map((x: any) => String(x || "").trim()).filter(Boolean)
    : [];
  const achievementLanguages = Array.isArray((candidateProfile as any)?.achievements)
    ? (candidateProfile as any).achievements
        .filter((item: any) => String(item?.category || "").toLowerCase() === "idioma")
        .map((item: any) => String(item?.title || "").trim())
        .filter(Boolean)
    : [];
  const importedLanguages = Array.isArray((candidateProfile as any)?.raw_cv_json?.company_cv_import?.extracted_payload?.languages)
    ? (candidateProfile as any).raw_cv_json.company_cv_import.extracted_payload.languages
        .map((item: any) => String(item || "").trim())
        .filter(Boolean)
    : [];
  const languagesDetected = Array.from(new Set([...profileLanguages, ...achievementLanguages, ...importedLanguages]));
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
    Number(Array.isArray((candidateProfile as any)?.education) && (candidateProfile as any).education.length > 0),
    Number(languagesDetected.length > 0),
  ];
  const onboardingCompletion = clampPercent(
    (completionSignals.reduce((acc, value) => acc + value, 0) / Math.max(1, completionSignals.length)) * 100
  );
  const importStatus = String((linkedInviteRes.data as any)?.status || "").toLowerCase();
  const companyImportInProgress =
    importStatus === "emailed" ||
    importStatus === "uploaded" ||
    importStatus === "accepted" ||
    (Boolean((candidateProfile as any)?.raw_cv_json?.company_cv_import) && onboardingCompletion < 70);
  const profileState =
    companyImportInProgress
      ? "en_construccion"
      : lastActivityAt && Date.now() - Date.parse(String(lastActivityAt)) < 7 * 24 * 60 * 60 * 1000
        ? "actualizado_recientemente"
        : "listo_para_ver";
  const snapshot = {
    experiences_detected: experienceCount,
    total_verifications: totalVerifications,
    approved_verifications: verifiedRows.length,
    verification_types: verificationTypes,
    verification_breakdown: verificationBreakdown,
    languages_detected: languagesDetected,
    trust_score: trustScore,
    onboarding_completion: onboardingCompletion,
    onboarding_status: companyImportInProgress ? "candidate_onboarding_in_progress" : "ready",
    profile_state: profileState,
    last_activity_at: lastActivityAt,
  };

  const companyId = String((requesterProfile as any)?.active_company_id || "").trim();
  const access = companyId
    ? await resolveCompanyCandidateAccess({
        service,
        companyId,
        candidateId: String(link.candidate_id),
      })
    : deriveCompanyCandidateAccess(null, null);

  if (mode === "preview") {
    return json(200, {
      candidate_id: link.candidate_id,
      view_mode: "preview",
      preview: snapshot,
      access,
      gate: {
        allowed: true,
        consumed: false,
        requires_overage: false,
        credits_remaining: null,
      },
    });
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

  if (access.access_status !== "active") {
    // Consumo de crédito solo cuando se pide el perfil completo y no existe acceso activo.
    const gateRes = await supabase.rpc("vj_consume_company_profile_view", {
      p_candidate_id: link.candidate_id,
    });
    gate = gateRes.data;
    const gateErr = gateRes.error;

    if (gateErr) {
      console.error("[company-candidate-token] gate failed", {
        candidate_id: link.candidate_id,
        company_id: (requesterProfile as any)?.active_company_id || null,
        message: gateErr.message,
        code: (gateErr as any)?.code || null,
      });
      return json(500, { error: "Gate failed" });
    }

    if (!gate?.allowed) {
      return json(402, {
        error: "No credits",
        reason: gate?.reason ?? "no_credits",
        credits_remaining: gate?.credits_remaining ?? null,
        upgrade_url: "/company/upgrade",
        preview: snapshot,
        access,
      });
    }

    if (gate?.consumed) {
      if (companyId) {
        const verificationId = String(verificationRows.find((row: any) => row?.verification_id)?.verification_id || "").trim() || null;
        try {
          const source = await resolveConsumptionSource({
            service,
            companyId,
            viewerUserId: au.user.id,
          });

          await service.from("profile_view_consumptions").insert({
            company_id: companyId,
            viewer_user_id: au.user.id,
            candidate_id: link.candidate_id,
            verification_id: verificationId,
            credits_spent: 1,
            source,
          });
          resolvedAccess = deriveCompanyCandidateAccess(new Date().toISOString(), source);
        } catch (logErr: any) {
          console.error("[company-candidate-token] consumption log failed", {
            candidate_id: link.candidate_id,
            company_id: companyId,
            viewer_user_id: au.user.id,
            message: logErr?.message || String(logErr),
          });
          resolvedAccess = deriveCompanyCandidateAccess(new Date().toISOString(), null);
        }
      }
    }
  } else {
    gate = {
      ...gate,
      allowed: true,
      consumed: false,
      credits_remaining: null,
    };
  }

  const experiencesBase = Math.max(1, verificationRows.length || 0);
  const trustComponents = {
    verification: Number.isFinite(Number(breakdownRaw?.verification))
      ? clampPercent(Number(breakdownRaw.verification))
      : clampPercent((verifiedRows.length / experiencesBase) * 100),
    evidence: Number.isFinite(Number(breakdownRaw?.evidence))
      ? clampPercent(Number(breakdownRaw.evidence))
      : clampPercent((evidencesCount / Math.max(1, experiencesBase * 2)) * 100),
    consistency: Number.isFinite(Number(breakdownRaw?.consistency))
      ? clampPercent(Number(breakdownRaw.consistency))
      : clampPercent(
          ((Number(Boolean((safe as any)?.title)) + Number(Boolean((safe as any)?.location)) + Number(!!(candidateProfile as any)?.job_search_status)) / 3) * 100
        ),
    reuse: Number.isFinite(Number(breakdownRaw?.reuse))
      ? clampPercent(Number(breakdownRaw.reuse))
      : clampPercent(
          (verificationRows.reduce((acc: number, r: any) => acc + Number(r?.reuse_count ?? 0), 0) / experiencesBase) * 100
        ),
  };
  const verificationTimeline = verificationRows
    .map((row: any) => ({
      verification_id: String(row?.verification_id || ""),
      position: row?.position || null,
      company_name: row?.company_name || row?.company_name_target || null,
      status: String(row?.status_effective || row?.status || "unknown"),
      evidence_count: Number(row?.evidence_count ?? row?.evidences_count ?? 0),
      reuse_count: Number(row?.reuse_count ?? 0),
      start_date: row?.start_date || null,
      end_date: row?.end_date || null,
      created_at: row?.created_at || null,
      resolved_at: row?.resolved_at || null,
    }))
    .sort((a, b) => {
      const ta = Date.parse(String(a.resolved_at || a.created_at || 0));
      const tb = Date.parse(String(b.resolved_at || b.created_at || 0));
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    })
    .slice(0, 12);

  return json(200, {
    candidate_id: link.candidate_id,
    view_mode: "full",
    preview: snapshot,
    access: resolvedAccess,
    profile: safe,
    contact,
    availability,
    credibility,
    trust_components: trustComponents,
    verification_timeline: verificationTimeline,
    gate: {
      allowed: true,
      consumed: !!gate?.consumed,
      requires_overage: !!gate?.requires_overage, // Enterprise sin créditos -> true
      overage_price: gate?.overage_price ?? null,
      credits_remaining: gate?.credits_remaining ?? null,
      period_start: gate?.period_start ?? null,
    },
  });
}
