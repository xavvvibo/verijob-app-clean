import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import type { ReactNode } from "react";
import { isOwnerSessionRole, resolveSessionRole } from "@/lib/auth/session-role";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { conversionStateLabel, loadVerificationCompanyAcquisition, subscriptionStateLabel } from "@/lib/owner/verification-company-acquisition";
import { isMissingExternalResolvedColumn } from "@/lib/verification/external-resolution";
import OwnerTooltip from "@/components/ui/OwnerTooltip";

type Severity = "high" | "medium" | "low";

type AlertItem = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
};

export const dynamic = "force-dynamic";

async function readOwnerVerificationRequests(admin: any) {
  const primary = await admin
    .from("verification_requests")
    .select("id,status,requested_at,created_at,resolved_at,company_id,requested_by,verification_channel,external_resolved");
  if (!primary.error || !isMissingExternalResolvedColumn(primary.error)) return primary;
  return admin
    .from("verification_requests")
    .select("id,status,requested_at,created_at,resolved_at,company_id,requested_by,verification_channel");
}

type GlobalSignalLevel = "ok" | "warning" | "critical";

function MetricCard({
  title,
  value,
  note,
  trend,
}: {
  title: ReactNode;
  value: string;
  note?: string;
  trend?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {trend ? <p className="mt-1 text-xs font-medium text-slate-700">{trend}</p> : null}
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </article>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function FunnelStep({
  step,
  value,
  rate,
  note,
}: {
  step: string;
  value: number;
  rate?: number | null;
  note?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{step}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {typeof rate === "number" ? <p className="mt-1 text-xs text-slate-500">{rate}% del paso anterior</p> : null}
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </article>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const tone =
    alert.severity === "high"
      ? "border-red-200 bg-red-50"
      : alert.severity === "medium"
        ? "border-amber-200 bg-amber-50"
        : "border-blue-200 bg-blue-50";

  const badgeTone =
    alert.severity === "high"
      ? "text-red-700"
      : alert.severity === "medium"
        ? "text-amber-700"
        : "text-blue-700";

  const badgeText =
    alert.severity === "high" ? "Alta" : alert.severity === "medium" ? "Media" : "Baja";

  return (
    <article className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{alert.title}</h3>
        <span className={`text-xs font-semibold uppercase tracking-wide ${badgeTone}`}>{badgeText}</span>
      </div>
      <p className="mt-1 text-sm text-slate-700">{alert.detail}</p>
      {alert.actionHref && alert.actionLabel ? (
        <Link href={alert.actionHref} className="mt-3 inline-flex text-xs font-semibold text-slate-800 underline">
          {alert.actionLabel}
        </Link>
      ) : null}
    </article>
  );
}

function signalStyles(level: GlobalSignalLevel) {
  if (level === "ok") return { dot: "bg-emerald-600", chip: "border-emerald-300 bg-emerald-100 text-emerald-900", label: "OK", border: "border-l-emerald-500" };
  if (level === "warning") return { dot: "bg-amber-600", chip: "border-amber-300 bg-amber-100 text-amber-900", label: "Atención", border: "border-l-amber-500" };
  return { dot: "bg-rose-600", chip: "border-rose-300 bg-rose-100 text-rose-900", label: "Acción", border: "border-l-rose-500" };
}

function GlobalSignalCard({
  title,
  level,
  detail,
}: {
  title: string;
  level: GlobalSignalLevel;
  detail: string;
}) {
  const styles = signalStyles(level);
  return (
    <article className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${styles.border}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
          <p className="text-sm font-semibold text-slate-900">{title}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${styles.chip}`}>{styles.label}</span>
      </div>
      <p className="mt-2 text-xs text-slate-600">{detail}</p>
    </article>
  );
}

function FunnelVisual({
  steps,
}: {
  steps: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        {steps.map((step) => {
          const width = Math.max(6, Math.round((step.value / max) * 100));
          return (
            <div key={step.label} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-700">{step.label}</span>
                <span className="font-semibold text-slate-900">{step.value}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100">
                <div className="h-2.5 rounded-full bg-blue-600" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyVerificationChart({
  labels,
  requested,
  verified,
}: {
  labels: string[];
  requested: number[];
  verified: number[];
}) {
  const width = 420;
  const height = 150;
  const padX = 26;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const maxValue = Math.max(1, ...requested, ...verified);
  const points = labels.map((_, idx) => {
    const x = padX + (idx * innerW) / Math.max(1, labels.length - 1);
    const yReq = padY + innerH - (requested[idx] / maxValue) * innerH;
    const yVer = padY + innerH - (verified[idx] / maxValue) * innerH;
    return { x, yReq, yVer };
  });
  const reqPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.yReq}`).join(" ");
  const verPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.yVer}`).join(" ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="#cbd5e1" strokeWidth="1" />
        <path d={reqPath} fill="none" stroke="#2563eb" strokeWidth="2.5" />
        <path d={verPath} fill="none" stroke="#16a34a" strokeWidth="2.5" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.yReq} r="2.5" fill="#2563eb" />
            <circle cx={p.x} cy={p.yVer} r="2.5" fill="#16a34a" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1 text-slate-700"><span className="h-2 w-2 rounded-full bg-blue-600" />Solicitudes</span>
        <span className="inline-flex items-center gap-1 text-slate-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />Verificadas</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-slate-500 sm:grid-cols-8">
        {labels.map((label, idx) => (
          <span key={`${label}-${idx}`} className="truncate">{label}</span>
        ))}
      </div>
    </div>
  );
}

function money(v: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v);
}

function pct(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function deltaLabel(current: number, previous: number, suffix = "") {
  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  const value = `${sign}${delta}${suffix}`;
  if (previous <= 0) return `${value} vs periodo anterior`;
  const ratio = Math.round((delta / previous) * 100);
  const ratioSign = ratio > 0 ? "+" : "";
  return `${value} (${ratioSign}${ratio}%) vs periodo anterior`;
}

type OverviewRange = "today" | "7d" | "30d" | "90d";

function normalizeOverviewRange(raw: unknown): OverviewRange {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "today") return "today";
  if (value === "7d") return "7d";
  if (value === "90d") return "90d";
  return "30d";
}

function overviewRangeDays(range: OverviewRange): number {
  if (range === "today") return 1;
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 30;
}

function overviewRangeLabel(range: OverviewRange): string {
  if (range === "today") return "hoy";
  if (range === "7d") return "7 días";
  if (range === "90d") return "90 días";
  return "30 días";
}

async function countAuthUsers(admin: ReturnType<typeof createServiceRoleClient>) {
  const perPage = 200;
  let page = 1;
  let total = 0;
  let guard = 0;
  while (guard < 100) {
    guard += 1;
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = Array.isArray(data?.users) ? data.users : [];
    total += users.length;
    if (users.length < perPage) break;
    page += 1;
  }
  return total;
}

export default async function OwnerOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OwnerOverviewServer searchParams={searchParams} />;
}

async function OwnerOverviewServer({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect("/login?next=/owner/overview");

  const { data: ownerProfile } = await sessionClient
    .from("profiles")
    .select("role,app_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const ownerRole = resolveSessionRole({
    profileRole: ownerProfile?.role,
    profileAppRole: (ownerProfile as any)?.app_role,
    user: auth.user,
  });
  if (!isOwnerSessionRole(ownerRole)) redirect("/dashboard?forbidden=1&from=owner");

  const admin = createServiceRoleClient();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const selectedRange = normalizeOverviewRange(sp?.range);
  const rangeDays = overviewRangeDays(selectedRange);
  const rangeLabel = overviewRangeLabel(selectedRange);
  const weekAgo = now - 7 * dayMs;
  const twoWeeksAgo = now - 14 * dayMs;
  const monthAgo = now - 30 * dayMs;
  const twoMonthsAgo = now - 60 * dayMs;
  const rangeStartMs = selectedRange === "today" ? (() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  })() : now - rangeDays * dayMs;
  const previousRangeStartMs = rangeStartMs - rangeDays * dayMs;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  const isInRange = (value: unknown, startMs = rangeStartMs, endMs = now) => {
    const ts = Date.parse(String(value || ""));
    return Number.isFinite(ts) && ts >= startMs && ts < endMs;
  };

  const [profilesRes, companiesRes, requestsRes, evidenceRes, subscriptionsRes, campaignsRes, jobsRes, publicLinksRes, issuesRes, employmentRes, candidateProfilesRes, platformEventsRes, companyMembersRes, ownerActionsRes, authUsersTotal] = await Promise.all([
    admin.from("profiles").select("id,role,active_company_id,onboarding_completed,created_at,last_activity_at"),
    admin.from("companies").select("id,name,trade_name,legal_name,created_at,updated_at,status", { count: "exact" }),
    readOwnerVerificationRequests(admin),
    admin.from("evidences").select("id,evidence_type,document_type,validation_status,verification_request_id,uploaded_by,created_at"),
    admin.from("subscriptions").select("id,user_id,status,amount,created_at,plan"),
    admin.from("growth_campaigns").select("*"),
    admin.from("cv_parse_jobs").select("id,status,created_at"),
    admin.from("candidate_public_links").select("id,candidate_id,public_token,expires_at,is_active,created_at"),
    admin.from("issue_reports").select("id,status,created_at"),
    admin.from("employment_records").select("id,candidate_id,created_at,verification_status"),
    admin.from("candidate_profiles").select("user_id,trust_score"),
    admin.from("platform_events").select("id,user_id,company_id,created_at"),
    admin.from("company_members").select("user_id,company_id,role"),
    admin.from("owner_actions").select("id,target_user_id,action_type,reason,created_at").order("created_at", { ascending: false }).limit(20),
    countAuthUsers(admin),
  ]);

  const profiles = Array.isArray(profilesRes.data) ? profilesRes.data : [];
  const companiesTotal = Number(companiesRes.count || 0);
  const requests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
  const evidenceRows = Array.isArray(evidenceRes.data) ? evidenceRes.data : [];
  const subscriptions = Array.isArray(subscriptionsRes.data) ? subscriptionsRes.data : [];
  const campaigns = Array.isArray(campaignsRes.data) ? campaignsRes.data : [];
  const jobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
  const publicLinks = Array.isArray(publicLinksRes.data) ? publicLinksRes.data : [];
  const issues = Array.isArray(issuesRes.data) ? issuesRes.data : [];
  const employments = Array.isArray(employmentRes.data) ? employmentRes.data : [];
  const candidateProfilesData = Array.isArray(candidateProfilesRes.data) ? candidateProfilesRes.data : [];
  const platformEvents = Array.isArray(platformEventsRes.data) ? platformEventsRes.data : [];
  const companyMembers = Array.isArray(companyMembersRes.data) ? companyMembersRes.data : [];
  const ownerActions = Array.isArray(ownerActionsRes.data) ? ownerActionsRes.data : [];
  const profilesForActivity = profiles;
  const companiesForActivity = Array.isArray(companiesRes.data) ? companiesRes.data : [];
  const profileById = new Map(profiles.map((row: any) => [String(row.id || ""), row]));
  const companyById = new Map(companiesForActivity.map((row: any) => [String(row.id || ""), row]));

  const candidateProfiles = profiles.filter((p: any) => String(p.role || "").toLowerCase() === "candidate");
  const companyProfiles = profiles.filter((p: any) => String(p.role || "").toLowerCase() === "company");
  const ownerProfiles = profiles.filter((p: any) => {
    const role = String(p.role || "").toLowerCase();
    return role === "owner" || role === "admin";
  });

  const candidateIds = new Set(candidateProfiles.map((p: any) => String(p.id || "")).filter(Boolean));

  const candidatesWithExperience = new Set(
    employments
      .map((row: any) => String(row.candidate_id || ""))
      .filter((id: string) => Boolean(id) && candidateIds.has(id))
  );

  const candidatesWithVerification = new Set(
    requests
      .map((row: any) => String(row.requested_by || ""))
      .filter((id: string) => Boolean(id) && candidateIds.has(id))
  );

  const verifiedRows = requests.filter((r: any) => String(r.status || "").toLowerCase() === "verified");
  const candidatesVerified = new Set(
    verifiedRows
      .map((r: any) => String(r.requested_by || ""))
      .filter((id: string) => Boolean(id) && candidateIds.has(id))
  );

  const usersTotal = authUsersTotal;
  const candidatesTotal = candidateProfiles.length;
  const companiesUsersTotal = companyProfiles.length;
  const ownersTotal = ownerProfiles.length;

  const onboardingCompleted = candidateProfiles.filter((p: any) => Boolean(p.onboarding_completed)).length;
  const onboardingPending = candidatesTotal - onboardingCompleted;

  const usersCreatedToday = profiles.filter((p: any) => {
    const ts = Date.parse(String(p.created_at || ""));
    return Number.isFinite(ts) && ts >= startOfTodayMs;
  }).length;
  const eventsToday = platformEvents.filter((ev: any) => {
    const ts = Date.parse(String(ev.created_at || ""));
    return Number.isFinite(ts) && ts >= startOfTodayMs;
  });
  const todayEventsTotal = eventsToday.length;
  const activeUsersTodaySet = new Set(
    eventsToday.map((ev: any) => String(ev.user_id || "")).filter(Boolean)
  );
  const usersActiveToday = activeUsersTodaySet.size;
  const candidatesActiveToday = new Set(
    Array.from(activeUsersTodaySet).filter((id) => candidateIds.has(id))
  ).size;

  const memberCompanyIdsByUser = new Map<string, Set<string>>();
  for (const member of companyMembers as any[]) {
    const userId = String(member.user_id || "");
    const companyId = String(member.company_id || "");
    const role = String(member.role || "").toLowerCase();
    if (!userId || !companyId) continue;
    if (role !== "admin" && role !== "reviewer") continue;
    const current = memberCompanyIdsByUser.get(userId) || new Set<string>();
    current.add(companyId);
    memberCompanyIdsByUser.set(userId, current);
  }
  const companiesActiveTodaySet = new Set<string>();
  for (const ev of eventsToday as any[]) {
    const companyId = String(ev.company_id || "");
    if (companyId) companiesActiveTodaySet.add(companyId);
    const userId = String(ev.user_id || "");
    if (!userId) continue;
    const actorProfile = profileById.get(userId) as any;
    const actorRole = String(actorProfile?.role || "").toLowerCase();
    if (actorRole === "company") {
      const activeCompanyId = String(actorProfile?.active_company_id || "");
      if (activeCompanyId) companiesActiveTodaySet.add(activeCompanyId);
    }
    const memberCompanySet = memberCompanyIdsByUser.get(userId);
    if (memberCompanySet) {
      for (const memberCompanyId of memberCompanySet) companiesActiveTodaySet.add(memberCompanyId);
    }
  }
  const companiesActiveToday = companiesActiveTodaySet.size;

  const activeProfiles = profilesForActivity.filter((p: any) => isInRange(p.last_activity_at, rangeStartMs, now)).length;
  const activeProfilesPrevPeriod = profilesForActivity.filter((p: any) => isInRange(p.last_activity_at, previousRangeStartMs, rangeStartMs)).length;

  const activeCompanies = companiesForActivity.filter((c: any) => isInRange(c.updated_at || c.created_at, rangeStartMs, now)).length;
  const activeCompaniesPrevPeriod = companiesForActivity.filter((c: any) => isInRange(c.updated_at || c.created_at, previousRangeStartMs, rangeStartMs)).length;
  const inactiveCompanies = Math.max(companiesTotal - activeCompanies, 0);

  const verificationsTotal = requests.length;
  const statusCounts = {
    draft: requests.filter((r: any) => String(r.status || "").toLowerCase() === "draft").length,
    pending_company: requests.filter((r: any) => String(r.status || "").toLowerCase() === "pending_company").length,
    reviewing: requests.filter((r: any) => String(r.status || "").toLowerCase() === "reviewing").length,
    verified: requests.filter((r: any) => String(r.status || "").toLowerCase() === "verified").length,
    rejected: requests.filter((r: any) => String(r.status || "").toLowerCase() === "rejected").length,
    revoked: requests.filter((r: any) => String(r.status || "").toLowerCase() === "revoked").length,
  };
  const pendingVerifications = statusCounts.draft + statusCounts.pending_company + statusCounts.reviewing;

  const resolvedRows = requests.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s === "verified" || s === "rejected" || s === "revoked";
  });
  const completedVerifications = resolvedRows.length;
  const verifiedVerifications = statusCounts.verified;
  const rejectedVerifications = statusCounts.rejected;
  const revokedVerifications = statusCounts.revoked;

  const requestsInRange = requests.filter((r: any) => isInRange(r.requested_at || r.created_at, rangeStartMs, now)).length;
  const requestsPrevRange = requests.filter((r: any) => isInRange(r.requested_at || r.created_at, previousRangeStartMs, rangeStartMs)).length;

  const verificationSuccessRate = pct(verifiedVerifications, completedVerifications);

  const resolutionHours = resolvedRows
    .map((row: any) => {
      const start = Date.parse(String(row.requested_at || row.created_at || ""));
      const end = Date.parse(String(row.resolved_at || ""));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return (end - start) / (1000 * 60 * 60);
    })
    .filter((v: number | null): v is number => typeof v === "number" && Number.isFinite(v));

  const avgVerificationHours =
    resolutionHours.length > 0
      ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
      : null;

  const evidencesTotal = evidenceRows.length;
  const evidencesUnlinked = evidenceRows.filter((e: any) => !e.verification_request_id).length;
  const evidencesLinked = evidencesTotal - evidencesUnlinked;
  const evidencesWithoutStatus = evidenceRows.filter((e: any) => {
    const st = String(e.validation_status || "").trim();
    return !st;
  }).length;

  const subscriptionsActive = subscriptions.filter((s: any) => {
    const st = String(s.status || "").toLowerCase();
    return st === "active" || st === "trialing";
  });

  const subscriptionsCanceled = subscriptions.filter((s: any) => String(s.status || "").toLowerCase() === "canceled");
  const subscriptionsPastDue = subscriptions.filter((s: any) => String(s.status || "").toLowerCase() === "past_due");
  const subscriptionsActivePrev30d = subscriptions.filter((s: any) => {
    const st = String(s.status || "").toLowerCase();
    if (st !== "active" && st !== "trialing") return false;
    const created = Date.parse(String(s.created_at || ""));
    return Number.isFinite(created) && created >= twoMonthsAgo && created < monthAgo;
  }).length;
  const subscriptionsNewRange = subscriptions.filter((s: any) => {
    const created = Date.parse(String(s.created_at || ""));
    return Number.isFinite(created) && created >= rangeStartMs && created < now;
  }).length;
  const subscriptionsNewPrevRange = subscriptions.filter((s: any) => {
    const created = Date.parse(String(s.created_at || ""));
    return Number.isFinite(created) && created >= previousRangeStartMs && created < rangeStartMs;
  }).length;

  const totalMrr = subscriptionsActive.reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;
  const mrrRangeAdded = subscriptionsActive
    .filter((row: any) => {
      const created = Date.parse(String(row.created_at || ""));
      return Number.isFinite(created) && created >= rangeStartMs && created < now;
    })
    .reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;

  const roleByUser = new Map<string, string>();
  for (const p of profiles as any[]) roleByUser.set(String(p.id || ""), String(p.role || "").toLowerCase());

  const candidateMrr =
    subscriptionsActive
      .filter((row: any) => roleByUser.get(String(row.user_id || "")) === "candidate")
      .reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;

  const companyMrr =
    subscriptionsActive
      .filter((row: any) => roleByUser.get(String(row.user_id || "")) === "company")
      .reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;

  const freeUsers = profiles.filter((p: any) => {
    const hasSub = subscriptionsActive.some((s: any) => String(s.user_id || "") === String(p.id || ""));
    return !hasSub;
  }).length;
  const paidUsers = subscriptionsActive.length;
  const freeToPaidRate = pct(paidUsers, freeUsers + paidUsers);
  const churnApprox = pct(subscriptionsCanceled.length, subscriptionsCanceled.length + subscriptionsActive.length);
  const arpuCandidate = candidatesTotal > 0 ? Math.round((candidateMrr / candidatesTotal) * 100) / 100 : 0;
  const arpuCompany = companiesUsersTotal > 0 ? Math.round((companyMrr / companiesUsersTotal) * 100) / 100 : 0;

  const activeCampaigns = campaigns.filter((row: any) => String(row.status || "").toLowerCase() === "running").length;
  const campaignsInRange = campaigns.filter((row: any) => {
    const created = Date.parse(String(row.created_at || ""));
    return Number.isFinite(created) && created >= rangeStartMs && created < now;
  });
  const leadsInRange = campaignsInRange.reduce((acc: number, row: any) => acc + Number(row.leads_discovered || 0), 0);
  const demosInRange = campaignsInRange.reduce((acc: number, row: any) => acc + Number(row.demos_count || 0), 0);
  const growthTotals = campaignsInRange.reduce(
    (acc: { leads: number; contacts: number; messages: number; replies: number; demos: number }, row: any) => {
      acc.leads += Number(row.leads_discovered || 0);
      acc.contacts += Number(row.contacts_found || 0);
      acc.messages += Number(row.messages_queued || 0);
      acc.replies += Number(row.replies_count || 0);
      acc.demos += Number(row.demos_count || 0);
      return acc;
    },
    { leads: 0, contacts: 0, messages: 0, replies: 0, demos: 0 }
  );

  const failedJobs = jobs.filter((j: any) => String(j.status || "").toLowerCase() === "failed").length;
  const pendingJobs = jobs.filter((j: any) => String(j.status || "").toLowerCase().includes("pending")).length;
  const pendingOldVerifications = requests.filter((r: any) => {
    const status = String(r.status || "").toLowerCase();
    const isPending = status === "draft" || status === "pending_company" || status === "reviewing";
    if (!isPending) return false;
    const ref = Date.parse(String(r.requested_at || r.created_at || ""));
    return Number.isFinite(ref) && ref < weekAgo;
  }).length;

  const openIssues = issues.filter((i: any) => {
    const st = String(i.status || "").toLowerCase();
    return st !== "closed" && st !== "resolved" && st !== "done";
  }).length;

  const weeklyLabels: string[] = [];
  const weeklyRequested: number[] = [];
  const weeklyVerified: number[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    const bucketStart = now - (i + 1) * 7 * dayMs;
    const bucketEnd = now - i * 7 * dayMs;
    weeklyLabels.push(new Date(bucketEnd).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }));
    weeklyRequested.push(
      requests.filter((r: any) => {
        const ts = Date.parse(String(r.requested_at || r.created_at || ""));
        return Number.isFinite(ts) && ts >= bucketStart && ts < bucketEnd;
      }).length
    );
    weeklyVerified.push(
      requests.filter((r: any) => {
        if (String(r.status || "").toLowerCase() !== "verified") return false;
        const ts = Date.parse(String(r.resolved_at || r.requested_at || r.created_at || ""));
        return Number.isFinite(ts) && ts >= bucketStart && ts < bucketEnd;
      }).length
    );
  }

  const activePublicProfiles = publicLinks.filter((p: any) => {
    if (!p.is_active) return false;
    if (!p.public_token) return false;
    if (!p.expires_at) return true;
    const ts = Date.parse(String(p.expires_at));
    return Number.isFinite(ts) ? ts > now : true;
  }).length;

  const companyProfilesCreatedInRange = companyProfiles.filter((p: any) => {
    const created = Date.parse(String(p.created_at || ""));
    return Number.isFinite(created) && created >= rangeStartMs && created < now;
  }).length;

  const candidateCohortIds = new Set(
    candidateProfiles
      .filter((p: any) => isInRange(p.created_at, rangeStartMs, now))
      .map((p: any) => String(p.id || ""))
      .filter(Boolean),
  );

  const funnelStepRegistros = candidateCohortIds.size;
  const funnelStepOnboarding = candidateProfiles.filter((p: any) => candidateCohortIds.has(String(p.id || "")) && Boolean(p.onboarding_completed)).length;
  const funnelStepExperience = new Set(Array.from(candidatesWithExperience).filter((id: string) => candidateCohortIds.has(id))).size;
  const funnelStepEvidence = new Set(
    evidenceRows
      .map((row: any) => String(row.uploaded_by || ""))
      .filter((id: string) => Boolean(id) && candidateCohortIds.has(id))
  ).size;
  const funnelStepVerificationRequested = new Set(Array.from(candidatesWithVerification).filter((id: string) => candidateCohortIds.has(id))).size;
  const funnelStepPublicProfileGenerated = new Set(
    publicLinks
      .map((row: any) => String(row.candidate_id || ""))
      .filter((id: string) => Boolean(id) && candidateCohortIds.has(id))
  ).size;
  const funnelStepVerified = new Set(Array.from(candidatesVerified).filter((id: string) => candidateCohortIds.has(id))).size;

  const onboardingRate = pct(funnelStepOnboarding, funnelStepRegistros);
  const profileReadyRate = pct(funnelStepExperience, funnelStepOnboarding);
  const evidenceRate = pct(funnelStepEvidence, funnelStepExperience);
  const verificationRequestedRate = pct(funnelStepVerificationRequested, funnelStepEvidence || funnelStepExperience);
  const publicProfileGeneratedRate = pct(funnelStepPublicProfileGenerated, funnelStepVerificationRequested || funnelStepEvidence);
  const verifiedRate = pct(funnelStepVerified, funnelStepPublicProfileGenerated || funnelStepVerificationRequested);

  const candidateTrustEntries: Array<[string, number]> = candidateProfilesData
    .map((row: any) => [String(row.user_id || ""), Number(row.trust_score || 0)] as [string, number])
    .filter((row) => Boolean(row[0]));
  const candidateTrustById = new Map<string, number>(candidateTrustEntries);
  let trustHigh = 0;
  let trustVerified = 0;
  let trustSignals = 0;
  let trustInVerification = 0;
  for (const candidate of candidateProfiles as any[]) {
    const score = Number(candidateTrustById.get(String(candidate.id || "")) || 0);
    if (score > 80) trustHigh += 1;
    else if (score >= 60) trustVerified += 1;
    else if (score >= 40) trustSignals += 1;
    else trustInVerification += 1;
  }

  const evidenceByRequest = new Map<string, number>();
  for (const ev of evidenceRows as any[]) {
    const key = String(ev.verification_request_id || "");
    if (!key) continue;
    evidenceByRequest.set(key, (evidenceByRequest.get(key) || 0) + 1);
  }
  const duplicateEvidenceLinks = Array.from(evidenceByRequest.values()).filter((c) => c > 1).length;

  const companyRejectStats = new Map<string, { total: number; rejected: number }>();
  for (const req of requests as any[]) {
    const company = String(req.company_id || "");
    if (!company) continue;
    const current = companyRejectStats.get(company) || { total: 0, rejected: 0 };
    current.total += 1;
    if (String(req.status || "").toLowerCase() === "rejected") current.rejected += 1;
    companyRejectStats.set(company, current);
  }
  const highRejectCompanies = Array.from(companyRejectStats.values()).filter((s) => s.total >= 5 && (s.rejected / s.total) >= 0.5).length;
  const suspiciousVerifications = highRejectCompanies + duplicateEvidenceLinks;
  const manualCasesOpen = openIssues + failedJobs;

  const globalSystemLevel: GlobalSignalLevel =
    failedJobs >= 3 || openIssues >= 8 || pendingOldVerifications >= 12
      ? "critical"
      : failedJobs > 0 || openIssues > 0 || pendingOldVerifications > 0
        ? "warning"
        : "ok";
  const globalVerificationLevel: GlobalSignalLevel =
    pendingVerifications >= 25 || verificationSuccessRate < 45
      ? "critical"
      : pendingVerifications > 8 || verificationSuccessRate < 65
        ? "warning"
        : "ok";
  const globalJobsLevel: GlobalSignalLevel =
    failedJobs >= 3 ? "critical" : failedJobs > 0 || pendingJobs > 0 ? "warning" : "ok";
  const globalIssuesLevel: GlobalSignalLevel =
    openIssues >= 8 ? "critical" : openIssues > 0 ? "warning" : "ok";

  const growthOpportunities: string[] = [];
  const verifiedWithoutCompany = Math.max(candidatesVerified.size - activeCompanies, 0);
  if (verifiedWithoutCompany > 0) {
    growthOpportunities.push(`${verifiedWithoutCompany} candidatos verificados sin cobertura equivalente de empresas activas.`);
  }
  if (activeProfiles > activeCompanies * 3) {
    growthOpportunities.push("Desbalance candidatos/empresas: conviene reforzar captación de empresas en zonas con mayor volumen de perfiles.");
  }
  if (leadsInRange === 0 && activeProfiles > 0) {
    growthOpportunities.push(`Sin leads de growth en ${rangeLabel} pese a actividad de perfiles: revisar campañas y canal.`);
  }

  const alerts: AlertItem[] = [];
  const recentCriticalEvents = [
    ...requests
      .filter((row: any) => {
        const ts = Date.parse(String(row.resolved_at || row.requested_at || row.created_at || ""));
        return Number.isFinite(ts) && ts >= rangeStartMs && String(row.status || "").toLowerCase() === "verified";
      })
      .slice(0, 4)
      .map((row: any) => ({
        ts: String(row.resolved_at || row.requested_at || row.created_at || ""),
        type: "verification_confirmed",
        title: "Verificación confirmada",
        detail: `${String((profileById.get(String(row.requested_by || "")) as any)?.full_name || "Candidato")} · ${String(row.verification_channel || "flujo estándar")}`,
      })),
    ...evidenceRows
      .filter((row: any) => isInRange(row.created_at, rangeStartMs, now))
      .slice(0, 3)
      .map((row: any) => ({
        ts: String(row.created_at || ""),
        type: "evidence_uploaded",
        title: "Nueva evidencia",
        detail: `${String((profileById.get(String(row.uploaded_by || "")) as any)?.full_name || "Usuario")} · ${String(row.document_type || row.evidence_type || "documento")}`,
      })),
    ...issues
      .filter((row: any) => {
        const ts = Date.parse(String(row.created_at || ""));
        return Number.isFinite(ts) && ts >= rangeStartMs;
      })
      .slice(0, 3)
      .map((row: any) => ({
        ts: String(row.created_at || ""),
        type: "issue_opened",
        title: "Incidencia reciente",
        detail: `Estado ${String(row.status || "abierta")}`,
      })),
    ...subscriptionsPastDue
      .filter((row: any) => isInRange(row.created_at, rangeStartMs, now))
      .slice(0, 3)
      .map((row: any) => ({
        ts: String(row.created_at || ""),
        type: "payment_failed",
        title: "Pago pendiente/fallido",
        detail: `${String((profileById.get(String(row.user_id || "")) as any)?.full_name || "Usuario")} · ${String(row.plan || "plan")}`,
      })),
    ...ownerActions
      .filter((row: any) => {
        const actionType = String(row.action_type || "").toLowerCase();
        return (actionType === "change_plan" || actionType === "extend_trial" || actionType === "cancel_subscription") && isInRange(row.created_at, rangeStartMs, now);
      })
      .slice(0, 4)
      .map((row: any) => ({
        ts: String(row.created_at || ""),
        type: "owner_billing_action",
        title: "Cambio manual owner",
        detail: `${String((profileById.get(String(row.target_user_id || "")) as any)?.full_name || "Usuario")} · ${String(row.action_type || "")}`,
      })),
  ]
    .filter((row: any) => row.ts)
    .sort((a, b) => Date.parse(String(b.ts || "")) - Date.parse(String(a.ts || "")))
    .slice(0, 8);

  if (verificationSuccessRate < 55 && completedVerifications >= 10) {
    alerts.push({
      id: "verification-success-low",
      severity: "high",
      title: "Ratio de verificación bajo",
      detail: `El ratio de éxito está en ${verificationSuccessRate}% con ${completedVerifications} casos resueltos.`,
      actionHref: "/owner/verifications",
      actionLabel: "Revisar verificaciones",
    });
  }

  if (pendingVerifications > 15) {
    alerts.push({
      id: "pending-verifications-high",
      severity: "high",
      title: "Cola de verificaciones alta",
      detail: `${pendingVerifications} verificaciones están pendientes y pueden frenar conversión.`,
      actionHref: "/owner/verifications",
      actionLabel: "Abrir cola pendiente",
    });
  }
  if (pendingOldVerifications > 0) {
    alerts.push({
      id: "pending-verifications-aged",
      severity: "medium",
      title: "Verificaciones pendientes con antigüedad",
      detail: `${pendingOldVerifications} verificaciones llevan más de 7 días sin cierre.`,
      actionHref: "/owner/verifications?status=reviewing",
      actionLabel: "Priorizar revisión",
    });
  }

  if (onboardingRate < 60 && funnelStepRegistros >= 20) {
    alerts.push({
      id: "onboarding-drop",
      severity: "medium",
      title: "Activación candidata por debajo de objetivo",
      detail: `Solo ${onboardingRate}% de registros completa onboarding candidato.`,
      actionHref: "/owner/users",
      actionLabel: "Analizar usuarios",
    });
  }

  if (requestsInRange === 0) {
    const lastVerificationTs = verifiedRows
      .map((r: any) => Date.parse(String(r.resolved_at || r.requested_at || r.created_at || "")))
      .filter((ts: number) => Number.isFinite(ts))
      .sort((a: number, b: number) => b - a)[0];
    const daysSinceLastVerification =
      Number.isFinite(lastVerificationTs) ? Math.max(0, Math.floor((now - Number(lastVerificationTs)) / dayMs)) : null;
    const historicalWeeklyAvg = weeklyVerified.length
      ? Math.round((weeklyVerified.reduce((a, b) => a + b, 0) / weeklyVerified.length) * 10) / 10
      : 0;
    alerts.push({
      id: "no-verifications-week",
      severity: "medium",
      title: `Sin verificaciones nuevas en ${rangeLabel}`,
      detail: `Última verificación: ${daysSinceLastVerification !== null ? `hace ${daysSinceLastVerification} días` : "sin histórico"} · media semanal histórica: ${historicalWeeklyAvg}.`,
      actionHref: "/owner/growth",
      actionLabel: "Revisar growth",
    });
  }

  if (evidencesTotal > 0 && evidencesUnlinked / evidencesTotal >= 0.5) {
    alerts.push({
      id: "evidence-unlinked-high",
      severity: "low",
      title: "Evidencias no vinculadas elevadas",
      detail: `${evidencesUnlinked} de ${evidencesTotal} evidencias siguen sin vínculo directo.`,
      actionHref: "/owner/evidences",
      actionLabel: "Auditar evidencias",
    });
  }
  if (highRejectCompanies > 0) {
    alerts.push({
      id: "high-reject-companies",
      severity: "medium",
      title: "Empresas con rechazo anómalo",
      detail: `${highRejectCompanies} empresas superan ratio alto de rechazo (>=50% con al menos 5 casos).`,
      actionHref: "/owner/verifications",
      actionLabel: "Investigar rechazos",
    });
  }

  const verificationAcquisition = await loadVerificationCompanyAcquisition(admin);
  const acquisitionPreview = verificationAcquisition.rows.slice(0, 5);
  const lastUpdated = new Date().toLocaleString("es-ES");

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Overview owner</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cockpit ejecutivo para seguir activación, operación, calidad de verificación y economía del negocio.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {([
            { value: "today", label: "Hoy" },
            { value: "7d", label: "7d" },
            { value: "30d", label: "30d" },
            { value: "90d", label: "90d" },
          ] as const).map((item) => {
            const active = selectedRange === item.value;
            return (
              <Link
                key={item.value}
                href={`/owner/overview?range=${item.value}`}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">Rango activo: {rangeLabel}</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">Última actualización: {lastUpdated}</span>
          <span className="text-slate-500">Los bloques dependientes del periodo se recalculan con este rango; los fijos lo indican en subtítulo.</span>
        </div>
      </section>

      <Section
        title="Estado global del sistema"
        subtitle="Semáforo rápido para detectar qué requiere acción inmediata."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <GlobalSignalCard
            title="Sistema"
            level={globalSystemLevel}
            detail={`${pendingOldVerifications} verificaciones antiguas · ${failedJobs} jobs fallidos · ${openIssues} incidencias abiertas`}
          />
          <GlobalSignalCard
            title="Cola verificaciones"
            level={globalVerificationLevel}
            detail={`${pendingVerifications} pendientes · ratio éxito ${verificationSuccessRate}%`}
          />
          <GlobalSignalCard
            title="Jobs automáticos"
            level={globalJobsLevel}
            detail={`${pendingJobs} pendientes · ${failedJobs} fallidos`}
          />
          <GlobalSignalCard
            title="Incidencias"
            level={globalIssuesLevel}
            detail={`${openIssues} abiertas · ${manualCasesOpen} casos manuales`}
          />
        </div>
      </Section>

      <Section title="Métricas clave" subtitle={`Estado del negocio para ${rangeLabel}, manteniendo MRR como foto actual.`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={<span className="inline-flex items-center gap-2">Perfiles activos ({rangeLabel}) <OwnerTooltip text="Perfiles con señal de actividad en el rango activo según last_activity_at." /></span>}
            value={String(activeProfiles)}
            trend={deltaLabel(activeProfiles, activeProfilesPrevPeriod)}
            note={`Total auth.users: ${usersTotal}`}
          />
          <MetricCard
            title={<span className="inline-flex items-center gap-2">Empresas activas ({rangeLabel}) <OwnerTooltip text="Empresas con actividad en el rango activo según updated_at/created_at." /></span>}
            value={String(activeCompanies)}
            trend={deltaLabel(activeCompanies, activeCompaniesPrevPeriod)}
            note={`Empresas totales: ${companiesTotal} · inactivas: ${inactiveCompanies}`}
          />
          <MetricCard
            title={<span className="inline-flex items-center gap-2">Verificaciones ({rangeLabel}) <OwnerTooltip text="Solicitudes creadas o solicitadas dentro del rango activo." /></span>}
            value={String(requestsInRange)}
            trend={deltaLabel(requestsInRange, requestsPrevRange)}
            note={`${pendingVerifications} en cola · ${verificationsTotal} acumuladas`}
          />
          <MetricCard
            title={<span className="inline-flex items-center gap-2">MRR activo <OwnerTooltip text="Derivado fiable: suma de amount en suscripciones active/trialing." /></span>}
            value={money(totalMrr)}
            note={`${subscriptionsActive.length} suscripciones activas · ${money(mrrRangeAdded)} añadidos en ${rangeLabel}`}
          />
        </div>
      </Section>

      <Section
        title="Actividad de hoy"
        subtitle="Pulso operativo diario sin estimaciones artificiales de presencia live."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Nuevos usuarios hoy" value={String(usersCreatedToday)} />
          <MetricCard title="Usuarios activos hoy" value={String(usersActiveToday)} note="Usuarios únicos con al menos 1 evento hoy" />
          <MetricCard title="Empresas activas hoy" value={String(companiesActiveToday)} note="Con evento asociado a company_id o actividad de actor company/admin/reviewer" />
          <MetricCard title="Candidatos activos hoy" value={String(candidatesActiveToday)} note="Usuarios role=candidate con al menos 1 evento hoy" />
          <MetricCard title="Eventos operativos hoy" value={String(todayEventsTotal)} note="Total de eventos registrados hoy en platform_events" />
        </div>
      </Section>

      <Section
        title="Embudo de activación"
        subtitle={`Cohorte de candidatos registrados en ${rangeLabel} y su estado actual dentro del funnel.`}
      >
        <FunnelVisual
          steps={[
            { label: "Registros", value: funnelStepRegistros },
            { label: "Onboarding completado", value: funnelStepOnboarding },
            { label: "Perfil con experiencia", value: funnelStepExperience },
            { label: "Evidencia subida", value: funnelStepEvidence },
            { label: "Verificación solicitada", value: funnelStepVerificationRequested },
            { label: "Perfil público generado", value: funnelStepPublicProfileGenerated },
            { label: "Perfil verificado", value: funnelStepVerified },
          ]}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <FunnelStep step="Registros" value={funnelStepRegistros} note="Candidatos en profiles" />
          <FunnelStep
            step="Onboarding completado"
            value={funnelStepOnboarding}
            rate={pct(funnelStepOnboarding, funnelStepRegistros)}
          />
          <FunnelStep
            step="Perfil con experiencia"
            value={funnelStepExperience}
            rate={profileReadyRate}
          />
          <FunnelStep
            step="Evidencia subida"
            value={funnelStepEvidence}
            rate={evidenceRate}
          />
          <FunnelStep
            step="Verificación solicitada"
            value={funnelStepVerificationRequested}
            rate={verificationRequestedRate}
          />
          <FunnelStep
            step="Perfil público generado"
            value={funnelStepPublicProfileGenerated}
            rate={publicProfileGeneratedRate}
          />
          <FunnelStep
            step="Perfil verificado"
            value={funnelStepVerified}
            rate={verifiedRate}
            note="Al menos una verificación en estado verified"
          />
        </div>
      </Section>

      <Section
        title="Distribución de confianza"
        subtitle="Lectura rápida de salud del Trust Score en la base de candidatos."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Alta confianza (>80)" value={String(trustHigh)} note={`Sobre ${candidatesTotal} candidatos`} />
          <MetricCard title="Perfil verificado (60-79)" value={String(trustVerified)} note={`Sobre ${candidatesTotal} candidatos`} />
          <MetricCard title="Señales verificadas (40-59)" value={String(trustSignals)} note={`Sobre ${candidatesTotal} candidatos`} />
          <MetricCard title="En verificación (<40)" value={String(trustInVerification)} note={`Sobre ${candidatesTotal} candidatos`} />
        </div>
      </Section>

      <Section
        title="Resumen de crecimiento"
        subtitle={`Salida operativa agregada de campañas creadas en ${rangeLabel}.`}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Leads descubiertos" value={String(growthTotals.leads)} note={`Campañas creadas en ${rangeLabel}`} />
          <MetricCard title="Contactos encontrados" value={String(growthTotals.contacts)} note={`Campañas creadas en ${rangeLabel}`} />
          <MetricCard title="Mensajes enviados" value={String(growthTotals.messages)} note={`Campañas creadas en ${rangeLabel}`} />
          <MetricCard title="Respuestas" value={String(growthTotals.replies)} note={`Campañas creadas en ${rangeLabel}`} />
          <MetricCard title="Demos agendadas" value={String(growthTotals.demos)} note={`Campañas creadas en ${rangeLabel}`} />
        </div>
      </Section>

      <Section
        title="Evolución de verificaciones por semana"
        subtitle="Comparativa semanal de solicitudes y verificaciones cerradas en estado aprobada."
      >
        <WeeklyVerificationChart
          labels={weeklyLabels}
          requested={weeklyRequested}
          verified={weeklyVerified}
        />
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="Operaciones diarias"
          subtitle="Foto actual de backlog y operación. Este bloque no se reescala con el rango para no mezclar inventario con flujo."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard title="Borrador pendiente de envío" value={String(statusCounts.draft)} />
            <MetricCard title="Esperando respuesta de empresa" value={String(statusCounts.pending_company)} />
            <MetricCard title="En revisión manual" value={String(statusCounts.reviewing)} />
            <MetricCard title="Verificaciones aprobadas" value={String(statusCounts.verified)} />
            <MetricCard title="Verificaciones rechazadas" value={String(statusCounts.rejected)} />
            <MetricCard title="Verificaciones revocadas" value={String(statusCounts.revoked)} />
            <MetricCard title="Evidencias totales" value={String(evidencesTotal)} />
            <MetricCard title="Evidencias pendientes de clasificación" value={String(evidencesWithoutStatus)} />
            <MetricCard title="Evidencias sin vinculación" value={String(evidencesUnlinked)} note={`Vinculadas: ${evidencesLinked}`} />
            <MetricCard title="Incidencias abiertas" value={String(openIssues)} />
            <MetricCard title={`Perfiles activos (${rangeLabel})`} value={String(activeProfiles)} />
            <MetricCard title={`Empresas nuevas (${rangeLabel})`} value={String(companyProfilesCreatedInRange)} />
          </div>
        </Section>

        <Section
          title="Calidad del sistema"
          subtitle="Salud de verificación: volumen, éxito, tiempos y carga de revisión."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard title="Ratio de éxito" value={`${verificationSuccessRate}%`} note="Aprobadas / verificaciones resueltas" />
            <MetricCard
              title="Tiempo medio verificación"
              value={avgVerificationHours !== null ? `${avgVerificationHours}h` : "—"}
              note="Desde solicitud hasta resolución"
            />
            <MetricCard title="Verificaciones rechazadas" value={String(rejectedVerifications)} note={`Revocadas ${revokedVerifications}`} />
            <MetricCard title="Jobs pendientes" value={String(pendingJobs)} note={`Jobs fallidos ${failedJobs}`} />
          </div>
        </Section>
      </div>

      <Section
        title="Integridad del sistema"
        subtitle="Señales de fraude, inconsistencias y degradación de confianza."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Verificaciones sospechosas" value={String(suspiciousVerifications)} note="Proxy por ratio de rechazo y duplicidad de evidencias" />
          <MetricCard title="Evidencias duplicadas" value={String(duplicateEvidenceLinks)} note="Múltiples evidencias sobre la misma solicitud" />
          <MetricCard title="Empresas con rechazo alto" value={String(highRejectCompanies)} note=">=50% de rechazo con volumen mínimo" />
          <MetricCard title="Casos manuales abiertos" value={String(manualCasesOpen)} note="Incidencias + jobs fallidos en seguimiento" />
        </div>
      </Section>

      <Section
        title="Oportunidades de crecimiento"
        subtitle={`Brechas detectadas con señales actuales y actividad de ${rangeLabel}.`}
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {growthOpportunities.length === 0 ? (
            <p className="text-sm text-slate-600">No se detectan oportunidades críticas con los umbrales actuales.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {growthOpportunities.map((op, idx) => (
                <li key={idx} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">{op}</li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section
        title="Economía del negocio"
        subtitle={`Composición de ingresos actual y ritmo de altas en ${rangeLabel}.`}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="MRR total" value={money(totalMrr)} note="Suscripciones activas/trialing" />
          <MetricCard title="MRR candidatos" value={money(candidateMrr)} note="Planes candidate_*" />
          <MetricCard title="MRR empresas" value={money(companyMrr)} note="Planes company/enterprise" />
          <MetricCard title="Suscripciones activas" value={String(subscriptionsActive.length)} />
          <MetricCard title={`Altas ${rangeLabel}`} value={String(subscriptionsNewRange)} note={deltaLabel(subscriptionsNewRange, subscriptionsNewPrevRange)} />
          <MetricCard title="Canceladas" value={String(subscriptionsCanceled.length)} />
          <MetricCard title="ARPU candidato (derivado)" value={money(arpuCandidate)} note="MRR candidato / total candidatos" />
          <MetricCard title="ARPU empresa (derivado)" value={money(arpuCompany)} note="MRR empresa / perfiles empresa" />
          <MetricCard title="Conversión free → paid" value={`${freeToPaidRate}%`} note="Usuarios con suscripción activa sobre base total" />
          <MetricCard title="Churn" value={`${churnApprox}%`} note="Canceladas sobre canceladas+activas" />
        </div>
      </Section>

      {alerts.length > 0 ? (
        <Section
          title="Alertas y anomalías"
          subtitle="Señales clave calculadas con umbrales operativos para reacción rápida."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        title="Eventos recientes y críticos"
        subtitle="Actividad reciente de alto impacto para operación, soporte y monetización."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {recentCriticalEvents.length ? (
            recentCriticalEvents.map((item, idx) => (
              <article key={`${item.type}-${item.ts}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-600">{item.detail}</div>
                  </div>
                  <span className={`mt-0.5 inline-flex h-2.5 w-2.5 rounded-full ${
                    item.type === "payment_failed" || item.type === "issue_opened"
                      ? "bg-rose-600"
                      : item.type === "verification_confirmed"
                        ? "bg-emerald-600"
                        : item.type === "owner_billing_action"
                          ? "bg-violet-600"
                          : "bg-blue-600"
                  }`} />
                </div>
                <div className="mt-2 text-xs text-slate-500">{new Date(item.ts).toLocaleString("es-ES")}</div>
              </article>
            ))
          ) : (
            <article className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
              Sin eventos críticos recientes fuera del flujo operativo habitual.
            </article>
          )}
        </div>
      </Section>

      <Section
        title="Acciones rápidas"
        subtitle="Prioridades operativas del día con acceso directo."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Link href="/owner/users" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Usuarios en seguimiento
            <span className="mt-1 block text-xs font-normal text-slate-500">{usersTotal} usuarios · {onboardingPending} onboarding pendiente</span>
          </Link>
          <Link href="/owner/companies" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Empresas a revisar
            <span className="mt-1 block text-xs font-normal text-slate-500">{inactiveCompanies} sin actividad reciente</span>
          </Link>
          <Link href="/owner/verifications?status=reviewing" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Cola de verificaciones
            <span className="mt-1 block text-xs font-normal text-slate-500">{pendingVerifications} pendientes · {pendingOldVerifications} &gt;7d</span>
          </Link>
          <Link href="/owner/monetization" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Monetización
            <span className="mt-1 block text-xs font-normal text-slate-500">MRR {money(totalMrr)} · altas {rangeLabel} {subscriptionsNewRange}</span>
          </Link>
          <Link href="/owner/growth" className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
            Centro de crecimiento
            <span className="mt-1 block text-xs font-normal text-blue-100">{activeCampaigns} campañas activas · {leadsInRange} leads en {rangeLabel}</span>
          </Link>
          <Link href="/owner/company-acquisition" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Empresas captadas por verificación
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {verificationAcquisition.summary.registeredFromVerification} registradas · {verificationAcquisition.summary.convertedToPaid} de pago
            </span>
          </Link>
        </div>
      </Section>

      <Section
        title="Empresas captadas por verificación"
        subtitle="Resumen operativo del embudo empresa generado desde solicitudes de verificación."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Impactadas" value={String(verificationAcquisition.summary.impactedCompanies)} note="Empresas con al menos una solicitud de verificación." />
          <MetricCard title="Registradas" value={String(verificationAcquisition.summary.registeredFromVerification)} note="Registro atribuido a verificación con señal disponible en datos." />
          <MetricCard title="Free" value={String(verificationAcquisition.summary.convertedToFree)} note="Onboarding completado y plan free." />
          <MetricCard title="Pago" value={String(verificationAcquisition.summary.convertedToPaid)} note={`Conversión a pago · ${verificationAcquisition.summary.verificationToPaymentRate}% del total impactado`} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Empresa</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Objetivo</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Solicitudes</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Conversión</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {acquisitionPreview.length ? (
                acquisitionPreview.map((row) => (
                  <tr key={row.key}>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{row.companyName}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.origin === "verification" ? "Captada por verificación" : row.origin === "preexisting" ? "Empresa preexistente" : "Origen no concluyente"}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <div>{row.targetEmail || "—"}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.targetDomain || "Dominio no concluyente"}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.requestsCount}</td>
                    <td className="px-3 py-3 text-slate-700">{conversionStateLabel(row.conversionState)}</td>
                    <td className="px-3 py-3 text-slate-700">{subscriptionStateLabel(row.subscriptionState)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay impacto de verificación suficiente para construir el resumen todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div>
          <Link href="/owner/company-acquisition" className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Abrir módulo completo
          </Link>
        </div>
      </Section>

      <Section
        title="Timeline global del sistema"
        subtitle={`Actividad reciente filtrada por ${rangeLabel}.`}
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <ul className="space-y-2 text-sm text-slate-700">
            {[
              ...verifiedRows.filter((r: any) => isInRange(r.resolved_at || r.requested_at || r.created_at, rangeStartMs, now)).slice(0, 3).map((r: any) => ({
                ts: String(r.resolved_at || r.requested_at || r.created_at || ""),
                type: "verification_approved",
                text: `Verificación aprobada · ${String((profileById.get(String(r.requested_by || "")) as any)?.full_name || "Candidato")}`,
              })),
              ...evidenceRows.filter((e: any) => isInRange(e.created_at, rangeStartMs, now)).slice(0, 3).map((e: any) => ({
                ts: String(e.created_at || ""),
                type: "evidence_uploaded",
                text: `Evidencia subida · ${String((profileById.get(String(e.uploaded_by || "")) as any)?.full_name || "Usuario")}`,
              })),
              ...companiesForActivity.filter((c: any) => isInRange(c.created_at || c.updated_at, rangeStartMs, now)).slice(0, 2).map((c: any) => ({
                ts: String(c.created_at || c.updated_at || ""),
                type: "company_activity",
                text: `Empresa activa · ${resolveCompanyDisplayName(companyById.get(String(c.id || "")) as any, "Tu empresa")}`,
              })),
              ...profiles.filter((p: any) => isInRange(p.created_at, rangeStartMs, now)).slice(0, 2).map((p: any) => ({
                ts: String(p.created_at || ""),
                type: "user_registered",
                text: `Usuario registrado · ${String((profileById.get(String(p.id || "")) as any)?.full_name || "Usuario")}`,
              })),
              ...issues.filter((i: any) => isInRange(i.created_at, rangeStartMs, now)).slice(0, 2).map((i: any) => ({
                ts: String(i.created_at || ""),
                type: "issue_created",
                text: "Incidencia operativa creada",
              })),
              ...campaigns.filter((c: any) => isInRange(c.created_at, rangeStartMs, now)).slice(0, 2).map((c: any) => ({
                ts: String(c.created_at || ""),
                type: "campaign_created",
                text: "Campaña de crecimiento lanzada",
              })),
              ...subscriptionsActive.filter((s: any) => isInRange(s.created_at, rangeStartMs, now)).slice(0, 2).map((s: any) => ({
                ts: String(s.created_at || ""),
                type: "subscription_activated",
                text: "Suscripción activada",
              })),
            ]
              .filter((x: any) => x.ts)
              .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
              .slice(0, 10)
              .map((item, idx) => (
                <li key={`${item.ts}-${idx}`} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${
                      item.type === "verification_approved" ? "bg-emerald-600" :
                      item.type === "issue_created" ? "bg-rose-600" :
                      item.type === "evidence_uploaded" ? "bg-indigo-600" :
                      item.type === "campaign_created" ? "bg-blue-600" :
                      item.type === "subscription_activated" ? "bg-violet-600" :
                      "bg-slate-500"
                    }`} />
                    <span className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {item.type === "verification_approved" ? "Verificación" :
                        item.type === "issue_created" ? "Incidencia" :
                        item.type === "evidence_uploaded" ? "Evidencia" :
                        item.type === "campaign_created" ? "Growth" :
                        item.type === "subscription_activated" ? "Suscripción" :
                        item.type === "user_registered" ? "Usuario" :
                        "Empresa"}
                    </span>
                    <span>{item.text}</span>
                  </span>
                  <span className="text-xs text-slate-500">{new Date(item.ts).toLocaleString("es-ES")}</span>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Perfiles públicos activos: {activePublicProfiles} · Jobs de parsing pendientes: {pendingJobs} · Demos de campañas en {rangeLabel}: {demosInRange}.
          </p>
        </div>
      </Section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Definiciones: usuarios totales salen de auth.users; operación y estados salen de verification_requests/evidences/issue_reports; MRR y churn se derivan de subscriptions activas/canceladas.
      </section>
    </div>
  );
}
