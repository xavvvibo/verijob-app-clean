import { visibleCompanyPlanName } from "@/lib/billing/planCapabilities";
import { readEffectiveSubscriptionStates } from "@/lib/billing/effectiveSubscription";
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";

type AcquisitionFilter =
  | "all"
  | "unregistered"
  | "registered"
  | "free"
  | "paid"
  | "multiple_requests"
  | "inactive";

type RegistrationState =
  | "not_registered"
  | "opened_link"
  | "registered"
  | "onboarding_completed";

type OnboardingState = "not_started" | "pending" | "completed";
type ConversionState =
  | "not_converted"
  | "converted_registration"
  | "converted_free"
  | "converted_paid";
type OriginState = "verification" | "preexisting" | "unknown";

export type VerificationCompanyAcquisitionRow = {
  key: string;
  companyId: string | null;
  companyUserId: string | null;
  companyName: string;
  targetEmail: string | null;
  targetDomain: string | null;
  requestsCount: number;
  firstRequestAt: string | null;
  lastRequestAt: string | null;
  lastActivityAt: string | null;
  registrationState: RegistrationState;
  onboardingState: OnboardingState;
  subscriptionState: string;
  conversionState: ConversionState;
  origin: OriginState;
  planLabel: string;
  isPaidPlan: boolean;
  companyWasPreexisting: boolean;
  hasMultipleRequests: boolean;
  hasRecentActivity: boolean;
  latestVerificationStatus: string;
};

export type VerificationCompanyAcquisitionSummary = {
  impactedCompanies: number;
  registeredFromVerification: number;
  convertedToFree: number;
  convertedToPaid: number;
  verificationToRegistrationRate: number;
  verificationToPaymentRate: number;
};

export type VerificationCompanyAcquisitionResult = {
  summary: VerificationCompanyAcquisitionSummary;
  rows: VerificationCompanyAcquisitionRow[];
  filteredRows: VerificationCompanyAcquisitionRow[];
};

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
]);

function asText(value: unknown) {
  return String(value || "").trim();
}

function safeIso(value: unknown) {
  const raw = asText(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function extractDomainFromEmail(emailRaw: unknown) {
  const email = asText(emailRaw).toLowerCase();
  const domain = email.includes("@") ? email.split("@")[1] : "";
  return domain || null;
}

function isCorporateDomain(domain: string | null) {
  return Boolean(domain && !PUBLIC_EMAIL_DOMAINS.has(domain));
}

function pushIso(values: string[], value: unknown) {
  const iso = safeIso(value);
  if (iso) values.push(iso);
}

function laterIso(values: Array<string | null | undefined>) {
  let best: string | null = null;
  for (const value of values) {
    const iso = safeIso(value);
    if (!iso) continue;
    if (!best || Date.parse(iso) > Date.parse(best)) best = iso;
  }
  return best;
}

function earlierIso(values: Array<string | null | undefined>) {
  let best: string | null = null;
  for (const value of values) {
    const iso = safeIso(value);
    if (!iso) continue;
    if (!best || Date.parse(iso) < Date.parse(best)) best = iso;
  }
  return best;
}

function pct(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function registrationStateLabel(state: RegistrationState) {
  if (state === "opened_link") return "Abrió enlace";
  if (state === "registered") return "Registrada";
  if (state === "onboarding_completed") return "Onboarding completado";
  return "No registrada";
}

export function onboardingStateLabel(state: OnboardingState) {
  if (state === "completed") return "Completado";
  if (state === "pending") return "Pendiente";
  return "No iniciado";
}

export function conversionStateLabel(state: ConversionState) {
  if (state === "converted_registration") return "Convertida a registro";
  if (state === "converted_free") return "Convertida a free";
  if (state === "converted_paid") return "Convertida a pago";
  return "No convertida";
}

export function originStateLabel(state: OriginState) {
  if (state === "verification") return "Verificación";
  if (state === "preexisting") return "Empresa preexistente";
  return "Origen no concluyente";
}

export function subscriptionStateLabel(state: string) {
  const value = asText(state).toLowerCase();
  if (!value || value === "no_plan") return "Sin plan";
  if (value === "free") return "Free";
  if (value === "access") return "Access";
  if (value === "hiring") return "Hiring";
  if (value === "team") return "Team";
  return "Legacy / otro";
}

function isPaidPlanName(plan: string) {
  const normalized = asText(plan).toLowerCase();
  return normalized === "access" || normalized === "hiring" || normalized === "team" || normalized === "enterprise";
}

function registrationTone(state: RegistrationState) {
  if (state === "onboarding_completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "registered") return "border-blue-200 bg-blue-50 text-blue-800";
  if (state === "opened_link") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function conversionTone(state: ConversionState) {
  if (state === "converted_paid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "converted_free") return "border-teal-200 bg-teal-50 text-teal-800";
  if (state === "converted_registration") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function verificationCompanyAcquisitionBadgeTone(
  kind: "registration" | "conversion" | "subscription",
  value: string,
) {
  if (kind === "registration") return registrationTone(value as RegistrationState);
  if (kind === "conversion") return conversionTone(value as ConversionState);
  const normalized = asText(value).toLowerCase();
  if (normalized === "team" || normalized === "hiring" || normalized === "access") {
    return "border-indigo-200 bg-indigo-50 text-indigo-800";
  }
  if (normalized === "free") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function registrationStateDisplay(state: RegistrationState) {
  return registrationStateLabel(state);
}

export async function loadVerificationCompanyAcquisition(
  admin: any,
  {
    filter = "all",
    q = "",
  }: {
    filter?: AcquisitionFilter;
    q?: string;
  } = {},
): Promise<VerificationCompanyAcquisitionResult> {
  let requestsRes = await admin
    .from("verification_requests")
    .select(
      "id,company_id,requested_by,status,verification_channel,requested_at,created_at,updated_at,resolved_at,external_resolved,company_name_target,company_email_target,external_email_target,request_context",
    )
    .order("requested_at", { ascending: false })
    .limit(1000);

  if (requestsRes.error && isMissingExternalResolvedColumn(requestsRes.error)) {
    requestsRes = await admin
      .from("verification_requests")
      .select(
        "id,company_id,requested_by,status,verification_channel,requested_at,created_at,updated_at,resolved_at,company_name_target,company_email_target,external_email_target,request_context",
      )
      .order("requested_at", { ascending: false })
      .limit(1000);
  }

  const requestRows = Array.isArray(requestsRes.data) ? requestsRes.data : [];

  type GroupBucket = {
    key: string;
    explicitCompanyId: string | null;
    targetEmail: string | null;
    targetDomain: string | null;
    companyNameTarget: string | null;
    requests: any[];
  };

  const grouped = new Map<string, GroupBucket>();
  for (const row of requestRows as any[]) {
    const requestContext = row?.request_context && typeof row.request_context === "object" ? row.request_context : {};
    const explicitCompanyId = asText(row?.company_id) || null;
    const targetEmail =
      asText(row?.company_email_target).toLowerCase() ||
      asText(row?.external_email_target).toLowerCase() ||
      asText((requestContext as any)?.company_email).toLowerCase() ||
      null;
    const domain = extractDomainFromEmail(targetEmail);
    const targetDomain = isCorporateDomain(domain) ? domain : null;
    const companyNameTarget =
      asText(row?.company_name_target) ||
      asText((requestContext as any)?.company_name) ||
      null;

    const key = explicitCompanyId
      ? `company:${explicitCompanyId}`
      : targetDomain
        ? `domain:${targetDomain}`
        : targetEmail
          ? `email:${targetEmail}`
          : companyNameTarget
            ? `name:${companyNameTarget.toLowerCase()}`
            : `request:${asText(row?.id)}`;

    const current = grouped.get(key) || {
      key,
      explicitCompanyId,
      targetEmail,
      targetDomain,
      companyNameTarget,
      requests: [],
    };

    if (!current.explicitCompanyId && explicitCompanyId) current.explicitCompanyId = explicitCompanyId;
    if (!current.targetEmail && targetEmail) current.targetEmail = targetEmail;
    if (!current.targetDomain && targetDomain) current.targetDomain = targetDomain;
    if (!current.companyNameTarget && companyNameTarget) current.companyNameTarget = companyNameTarget;
    current.requests.push(row);
    grouped.set(key, current);
  }

  const allCompanyProfilesRes = await admin
    .from("profiles")
    .select("id,email,role,active_company_id,onboarding_completed,created_at,last_activity_at")
    .eq("role", "company");
  const allCompanyProfiles = Array.isArray(allCompanyProfilesRes.data) ? allCompanyProfilesRes.data : [];

  const profilesByEmail = new Map<string, any[]>();
  for (const row of allCompanyProfiles as any[]) {
    const email = asText(row?.email).toLowerCase();
    if (!email) continue;
    profilesByEmail.set(email, [...(profilesByEmail.get(email) || []), row]);
  }

  const targetProfiles = Array.from(
    new Set(
      Array.from(grouped.values())
        .map((group) => {
          const direct = group.targetEmail ? profilesByEmail.get(group.targetEmail) || [] : [];
          return direct.map((row: any) => String(row?.id || ""));
        })
        .flat()
        .filter(Boolean),
    ),
  );

  const companyMembersRes = targetProfiles.length
    ? await admin
        .from("company_members")
        .select("company_id,user_id,role,created_at")
        .in("user_id", targetProfiles)
        .order("created_at", { ascending: false })
    : { data: [] };
  const memberships = Array.isArray((companyMembersRes as any).data) ? (companyMembersRes as any).data : [];

  const membershipByUser = new Map<string, any[]>();
  for (const row of memberships as any[]) {
    const key = asText(row?.user_id);
    if (!key) continue;
    membershipByUser.set(key, [...(membershipByUser.get(key) || []), row]);
  }

  const resolvedCompanyIds = new Set<string>();
  for (const group of grouped.values()) {
    if (group.explicitCompanyId) resolvedCompanyIds.add(group.explicitCompanyId);
    if (group.targetEmail) {
      const matchedProfiles = (profilesByEmail.get(group.targetEmail) || []).slice().sort((a: any, b: any) => {
        const aTs = Date.parse(String(a?.last_activity_at || a?.created_at || "")) || 0;
        const bTs = Date.parse(String(b?.last_activity_at || b?.created_at || "")) || 0;
        return bTs - aTs;
      });
      for (const matched of matchedProfiles) {
        const activeCompanyId = asText((matched as any)?.active_company_id);
        if (activeCompanyId) {
          resolvedCompanyIds.add(activeCompanyId);
          break;
        }
        const memberRows = membershipByUser.get(asText((matched as any)?.id)) || [];
        const memberCompanyId = asText(memberRows[0]?.company_id);
        if (memberCompanyId) {
          resolvedCompanyIds.add(memberCompanyId);
          break;
        }
      }
    }
  }

  const companyIds = Array.from(resolvedCompanyIds);
  const [companiesRes, companyProfilesRes] = await Promise.all([
    companyIds.length
      ? admin.from("companies").select("id,name,created_at,updated_at,status").in("id", companyIds)
      : Promise.resolve({ data: [] } as any),
    companyIds.length
      ? admin
          .from("company_profiles")
          .select("company_id,trade_name,legal_name,company_name,profile_completeness_score")
          .in("company_id", companyIds)
      : Promise.resolve({ data: [] } as any),
  ]);

  const companiesById = new Map((Array.isArray(companiesRes.data) ? companiesRes.data : []).map((row: any) => [asText(row?.id), row]));
  const companyProfilesById = new Map((Array.isArray(companyProfilesRes.data) ? companyProfilesRes.data : []).map((row: any) => [asText(row?.company_id), row]));

  const matchedUserIds = new Set<string>();
  const resolvedCompanyUserByGroup = new Map<string, any | null>();
  const resolvedCompanyIdByGroup = new Map<string, string | null>();

  for (const group of grouped.values()) {
    let matchedProfile: any | null = null;
    const directProfiles = group.targetEmail ? profilesByEmail.get(group.targetEmail) || [] : [];
    const sortedProfiles = directProfiles.slice().sort((a: any, b: any) => {
      const aHasCompany = asText(a?.active_company_id) ? 1 : 0;
      const bHasCompany = asText(b?.active_company_id) ? 1 : 0;
      if (bHasCompany !== aHasCompany) return bHasCompany - aHasCompany;
      const aTs = Date.parse(String(a?.last_activity_at || a?.created_at || "")) || 0;
      const bTs = Date.parse(String(b?.last_activity_at || b?.created_at || "")) || 0;
      return bTs - aTs;
    });
    matchedProfile = sortedProfiles[0] || null;

    let resolvedCompanyId = group.explicitCompanyId || null;
    if (!resolvedCompanyId && matchedProfile) {
      resolvedCompanyId = asText(matchedProfile?.active_company_id) || null;
      if (!resolvedCompanyId) {
        const membershipsForUser = membershipByUser.get(asText(matchedProfile?.id)) || [];
        resolvedCompanyId = asText(membershipsForUser[0]?.company_id) || null;
      }
    }

    if (matchedProfile) matchedUserIds.add(asText(matchedProfile?.id));
    resolvedCompanyUserByGroup.set(group.key, matchedProfile);
    resolvedCompanyIdByGroup.set(group.key, resolvedCompanyId);
  }

  const effectiveStates = await readEffectiveSubscriptionStates(admin, Array.from(matchedUserIds));

  const nowMs = Date.now();
  const inactiveThresholdMs = nowMs - 14 * 24 * 60 * 60 * 1000;

  const rows = Array.from(grouped.values())
    .map((group) => {
      const matchedProfile = (resolvedCompanyUserByGroup.get(group.key) || null) as any;
      const companyUserId = matchedProfile ? asText(matchedProfile.id) : null;
      const resolvedCompanyId = resolvedCompanyIdByGroup.get(group.key) || null;
      const company = (resolvedCompanyId ? companiesById.get(resolvedCompanyId) : null) as any;
      const companyProfile = (resolvedCompanyId ? companyProfilesById.get(resolvedCompanyId) : null) as any;
      const state = companyUserId ? effectiveStates.get(companyUserId) : null;
      const planLabel = state ? visibleCompanyPlanName(state.plan) : "Sin plan";
      const normalizedPlan = asText(planLabel).toLowerCase();
      const isPaid = isPaidPlanName(normalizedPlan);
      const requestTimes: string[] = [];
      let anyExternalResolved = false;
      let latestStatus = "";
      for (const request of group.requests as any[]) {
        pushIso(requestTimes, request?.requested_at || request?.created_at);
        pushIso(requestTimes, request?.resolved_at);
        pushIso(requestTimes, request?.updated_at);
        if (isVerificationExternallyResolved(request)) anyExternalResolved = true;
        const status = asText(request?.status).toLowerCase();
        if (status) latestStatus = status;
      }
      const firstRequestAt = earlierIso(group.requests.map((request: any) => request?.requested_at || request?.created_at));
      const lastRequestAt = laterIso(group.requests.map((request: any) => request?.requested_at || request?.created_at));
      const lastActivityAt = laterIso([
        ...requestTimes,
        matchedProfile?.last_activity_at,
        matchedProfile?.created_at,
        company?.updated_at,
        company?.created_at,
      ]);

      let registrationState: RegistrationState = "not_registered";
      if (matchedProfile || resolvedCompanyId) registrationState = "registered";
      if (anyExternalResolved && registrationState === "not_registered") registrationState = "opened_link";
      if (matchedProfile?.onboarding_completed) registrationState = "onboarding_completed";

      const onboardingState: OnboardingState = matchedProfile
        ? matchedProfile.onboarding_completed
          ? "completed"
          : "pending"
        : "not_started";

      const subscriptionState = !matchedProfile
        ? "no_plan"
        : isPaid
          ? normalizedPlan
          : "free";

      const conversionState: ConversionState =
        registrationState === "not_registered" && !matchedProfile && !resolvedCompanyId
          ? "not_converted"
          : isPaid
            ? "converted_paid"
            : onboardingState === "completed"
              ? "converted_free"
              : "converted_registration";

      const companyCreatedAt = earlierIso([company?.created_at, matchedProfile?.created_at]);
      const companyWasPreexisting =
        Boolean(companyCreatedAt && firstRequestAt) && Date.parse(String(companyCreatedAt)) < Date.parse(String(firstRequestAt));
      const origin: OriginState = matchedProfile || resolvedCompanyId ? (companyWasPreexisting ? "preexisting" : "verification") : "unknown";

      return {
        key: group.key,
        companyId: resolvedCompanyId,
        companyUserId,
        companyName: resolveCompanyDisplayName(
          resolvedCompanyId
            ? { ...(company || {}), ...(companyProfile || {}), company_name: group.companyNameTarget || null }
            : group.companyNameTarget || group.targetDomain || group.targetEmail || "Empresa impactada",
          "Empresa impactada",
        ),
        targetEmail: group.targetEmail,
        targetDomain: group.targetDomain,
        requestsCount: group.requests.length,
        firstRequestAt,
        lastRequestAt,
        lastActivityAt,
        registrationState,
        onboardingState,
        subscriptionState,
        conversionState,
        origin,
        planLabel,
        isPaidPlan: isPaid,
        companyWasPreexisting,
        hasMultipleRequests: group.requests.length > 1,
        hasRecentActivity: Boolean(lastActivityAt && Date.parse(String(lastActivityAt)) >= inactiveThresholdMs),
        latestVerificationStatus: latestStatus || "pending",
      } as VerificationCompanyAcquisitionRow;
    })
    .sort((a, b) => {
      const aTs = Date.parse(String(a.lastActivityAt || a.lastRequestAt || a.firstRequestAt || "")) || 0;
      const bTs = Date.parse(String(b.lastActivityAt || b.lastRequestAt || b.firstRequestAt || "")) || 0;
      return bTs - aTs;
    });

  const capturedRows = rows.filter((row) => row.origin === "verification");
  const summary = {
    impactedCompanies: rows.length,
    registeredFromVerification: capturedRows.filter((row) => row.registrationState === "registered" || row.registrationState === "onboarding_completed").length,
    convertedToFree: capturedRows.filter((row) => row.conversionState === "converted_free").length,
    convertedToPaid: capturedRows.filter((row) => row.conversionState === "converted_paid").length,
    verificationToRegistrationRate: pct(
      capturedRows.filter((row) => row.registrationState === "registered" || row.registrationState === "onboarding_completed").length,
      rows.length,
    ),
    verificationToPaymentRate: pct(
      capturedRows.filter((row) => row.conversionState === "converted_paid").length,
      rows.length,
    ),
  } satisfies VerificationCompanyAcquisitionSummary;

  const query = asText(q).toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (filter === "unregistered" && row.registrationState !== "not_registered" && row.registrationState !== "opened_link") return false;
    if (filter === "registered" && row.registrationState !== "registered" && row.registrationState !== "onboarding_completed") return false;
    if (filter === "free" && row.conversionState !== "converted_free") return false;
    if (filter === "paid" && row.conversionState !== "converted_paid") return false;
    if (filter === "multiple_requests" && !row.hasMultipleRequests) return false;
    if (filter === "inactive" && row.hasRecentActivity) return false;
    if (query) {
      const haystack = [
        row.companyName,
        row.targetEmail,
        row.targetDomain,
        row.subscriptionState,
        row.planLabel,
        registrationStateLabel(row.registrationState),
      ]
        .map((value) => asText(value).toLowerCase())
        .join(" ");
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return { summary, rows, filteredRows };
}
