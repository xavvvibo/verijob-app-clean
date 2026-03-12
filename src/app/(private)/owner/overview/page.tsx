import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import type { ReactNode } from "react";
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

export default function OwnerOverviewPage() {
  return <OwnerOverviewServer />;
}

async function OwnerOverviewServer() {
  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect("/login?next=/owner/overview");

  const { data: ownerProfile } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (ownerRole !== "owner" && ownerRole !== "admin") redirect("/dashboard?forbidden=1&from=owner");

  const admin = createServiceRoleClient();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * dayMs;
  const twoWeeksAgo = now - 14 * dayMs;
  const monthAgo = now - 30 * dayMs;
  const twoMonthsAgo = now - 60 * dayMs;

  const [profilesRes, companiesRes, requestsRes, evidenceRes, subscriptionsRes, campaignsRes, jobsRes, publicProfilesRes, issuesRes, employmentRes, authUsersTotal] = await Promise.all([
    admin.from("profiles").select("id,role,onboarding_completed,created_at,last_activity_at"),
    admin.from("companies").select("id,name,created_at,updated_at,status", { count: "exact" }),
    admin.from("verification_requests").select("id,status,requested_at,created_at,resolved_at,company_id,requested_by,verification_channel,external_resolved"),
    admin.from("evidences").select("id,evidence_type,document_type,validation_status,verification_request_id,uploaded_by,created_at"),
    admin.from("subscriptions").select("id,user_id,status,amount,created_at,plan"),
    admin.from("growth_campaigns").select("*"),
    admin.from("cv_parse_jobs").select("id,status,created_at"),
    admin.from("profiles").select("id,public_token,expires_at"),
    admin.from("issue_reports").select("id,status,created_at"),
    admin.from("employment_records").select("id,candidate_id,created_at,verification_status"),
    countAuthUsers(admin),
  ]);

  const profiles = Array.isArray(profilesRes.data) ? profilesRes.data : [];
  const companiesTotal = Number(companiesRes.count || 0);
  const requests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
  const evidenceRows = Array.isArray(evidenceRes.data) ? evidenceRes.data : [];
  const subscriptions = Array.isArray(subscriptionsRes.data) ? subscriptionsRes.data : [];
  const campaigns = Array.isArray(campaignsRes.data) ? campaignsRes.data : [];
  const jobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
  const publicProfiles = Array.isArray(publicProfilesRes.data) ? publicProfilesRes.data : [];
  const issues = Array.isArray(issuesRes.data) ? issuesRes.data : [];
  const employments = Array.isArray(employmentRes.data) ? employmentRes.data : [];
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

  const activeProfiles = profilesForActivity.filter((p: any) => {
    const ts = Date.parse(String(p.last_activity_at || ""));
    return Number.isFinite(ts) && ts >= monthAgo;
  }).length;
  const activeProfilesPrev30d = profilesForActivity.filter((p: any) => {
    const ts = Date.parse(String(p.last_activity_at || ""));
    return Number.isFinite(ts) && ts >= twoMonthsAgo && ts < monthAgo;
  }).length;

  const activeCompanies = companiesForActivity.filter((c: any) => {
    const ts = Date.parse(String(c.updated_at || c.created_at || ""));
    return Number.isFinite(ts) && ts >= monthAgo;
  }).length;
  const activeCompaniesPrev30d = companiesForActivity.filter((c: any) => {
    const ts = Date.parse(String(c.updated_at || c.created_at || ""));
    return Number.isFinite(ts) && ts >= twoMonthsAgo && ts < monthAgo;
  }).length;
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

  const requestsThisWeek = requests.filter((r: any) => {
    const ref = Date.parse(String(r.requested_at || r.created_at || ""));
    return Number.isFinite(ref) && ref >= weekAgo;
  }).length;
  const requestsPrevWeek = requests.filter((r: any) => {
    const ref = Date.parse(String(r.requested_at || r.created_at || ""));
    return Number.isFinite(ref) && ref >= twoWeeksAgo && ref < weekAgo;
  }).length;

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
  const subscriptionsNew30d = subscriptions.filter((s: any) => {
    const created = Date.parse(String(s.created_at || ""));
    return Number.isFinite(created) && created >= monthAgo;
  }).length;

  const totalMrr = subscriptionsActive.reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;
  const mrr30dAdded = subscriptionsActive
    .filter((row: any) => {
      const created = Date.parse(String(row.created_at || ""));
      return Number.isFinite(created) && created >= monthAgo;
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
  const weekCampaigns = campaigns.filter((row: any) => {
    const created = Date.parse(String(row.created_at || ""));
    return Number.isFinite(created) && created >= weekAgo;
  });
  const leadsThisWeek = weekCampaigns.reduce((acc: number, row: any) => acc + Number(row.leads_discovered || 0), 0);
  const demosThisWeek = weekCampaigns.reduce((acc: number, row: any) => acc + Number(row.demos_count || 0), 0);

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

  const activePublicProfiles = publicProfiles.filter((p: any) => {
    if (!p.public_token) return false;
    if (!p.expires_at) return true;
    const ts = Date.parse(String(p.expires_at));
    return Number.isFinite(ts) ? ts > now : true;
  }).length;

  const companyProfilesCreatedWeek = companyProfiles.filter((p: any) => {
    const created = Date.parse(String(p.created_at || ""));
    return Number.isFinite(created) && created >= weekAgo;
  }).length;

  const funnelStepRegistros = candidatesTotal;
  const funnelStepOnboarding = onboardingCompleted;
  const funnelStepExperience = candidatesWithExperience.size;
  const funnelStepFirstVerification = candidatesWithVerification.size;
  const funnelStepVerified = candidatesVerified.size;

  const onboardingRate = pct(funnelStepOnboarding, funnelStepRegistros);
  const profileReadyRate = pct(funnelStepExperience, funnelStepOnboarding);
  const firstVerificationRate = pct(funnelStepFirstVerification, funnelStepExperience);
  const verifiedRate = pct(funnelStepVerified, funnelStepFirstVerification);

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

  const growthOpportunities: string[] = [];
  const verifiedWithoutCompany = Math.max(candidatesVerified.size - activeCompanies, 0);
  if (verifiedWithoutCompany > 0) {
    growthOpportunities.push(`${verifiedWithoutCompany} candidatos verificados sin cobertura equivalente de empresas activas.`);
  }
  if (activeProfiles > activeCompanies * 3) {
    growthOpportunities.push("Desbalance candidatos/empresas: conviene reforzar captación de empresas en zonas con mayor volumen de perfiles.");
  }
  if (leadsThisWeek === 0 && activeProfiles > 0) {
    growthOpportunities.push("Sin leads de growth esta semana pese a actividad de perfiles: revisar campañas y canal.");
  }

  const alerts: AlertItem[] = [];

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
      actionHref: "/owner/verifications?status=pendiente",
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

  if (requestsThisWeek === 0) {
    alerts.push({
      id: "no-verifications-week",
      severity: "medium",
      title: "Sin verificaciones nuevas esta semana",
      detail: "No se detectan solicitudes recientes; revisar adquisición y activación.",
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

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Centro de dirección owner</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cockpit ejecutivo para seguir activación, operación, calidad de verificación y economía del negocio.
        </p>
      </section>

      <Section title="Métricas clave" subtitle="Estado del negocio en una lectura de 3 segundos.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={<span className="inline-flex items-center gap-2">Perfiles activos (30d) <OwnerTooltip text="Perfiles con señal de actividad en los últimos 30 días según last_activity_at." /></span>}
            value={String(activeProfiles)}
            trend={deltaLabel(activeProfiles, activeProfilesPrev30d)}
            note={`Total auth.users: ${usersTotal}`}
          />
          <MetricCard
            title={<span className="inline-flex items-center gap-2">Empresas activas (30d) <OwnerTooltip text="Empresas con actividad reciente según updated_at/created_at en los últimos 30 días." /></span>}
            value={String(activeCompanies)}
            trend={deltaLabel(activeCompanies, activeCompaniesPrev30d)}
            note={`Empresas totales: ${companiesTotal} · inactivas: ${inactiveCompanies}`}
          />
          <MetricCard
            title={<span className="inline-flex items-center gap-2">Verificaciones (7 días) <OwnerTooltip text="Solicitudes de verificación creadas/solicitadas durante la última semana." /></span>}
            value={String(requestsThisWeek)}
            trend={deltaLabel(requestsThisWeek, requestsPrevWeek)}
            note={`${pendingVerifications} en cola · ${verificationsTotal} acumuladas`}
          />
          <MetricCard
            title={<span className="inline-flex items-center gap-2">MRR activo <OwnerTooltip text="Derivado fiable: suma de amount en suscripciones active/trialing." /></span>}
            value={money(totalMrr)}
            note={`${subscriptionsActive.length} suscripciones activas · ${money(mrr30dAdded)} añadidos en 30d`}
          />
        </div>
      </Section>

      <Section
        title="Embudo de activación"
        subtitle="Detección rápida de fricción desde registro candidato hasta perfil verificado."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            step="Primera verificación"
            value={funnelStepFirstVerification}
            rate={firstVerificationRate}
          />
          <FunnelStep
            step="Perfil verificado"
            value={funnelStepVerified}
            rate={verifiedRate}
            note="Al menos una verificación en estado verified"
          />
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="Operaciones diarias"
          subtitle="Cola operativa para decisiones del día y revisión manual."
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
            <MetricCard title="Perfiles activos (30d)" value={String(activeProfiles)} />
            <MetricCard title="Empresas nuevas (7 días)" value={String(companyProfilesCreatedWeek)} />
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
        subtitle="Brechas detectadas entre oferta verificada y demanda empresarial."
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
        subtitle="Composición de ingresos y ritmo de monetización actual."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="MRR total" value={money(totalMrr)} note="Suscripciones activas/trialing" />
          <MetricCard title="MRR candidatos" value={money(candidateMrr)} note="Planes candidate_*" />
          <MetricCard title="MRR empresas" value={money(companyMrr)} note="Planes company/enterprise" />
          <MetricCard title="Suscripciones activas" value={String(subscriptionsActive.length)} />
          <MetricCard title="Altas últimos 30 días" value={String(subscriptionsNew30d)} />
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
        title="Acciones rápidas"
        subtitle="Prioridades operativas del día con acceso directo."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
            <span className="mt-1 block text-xs font-normal text-slate-500">MRR {money(totalMrr)} · altas 30d {subscriptionsNew30d}</span>
          </Link>
          <Link href="/owner/growth" className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
            Centro de crecimiento
            <span className="mt-1 block text-xs font-normal text-blue-100">{activeCampaigns} campañas activas · {leadsThisWeek} leads/semana</span>
          </Link>
        </div>
      </Section>

      <Section
        title="Timeline global del sistema"
        subtitle="Actividad reciente para seguimiento operativo transversal."
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <ul className="space-y-2 text-sm text-slate-700">
            {[
              ...verifiedRows.slice(0, 3).map((r: any) => ({
                ts: String(r.resolved_at || r.requested_at || r.created_at || ""),
                text: `Verificación completada · ${String((profileById.get(String(r.requested_by || "")) as any)?.full_name || "Candidato")}`,
              })),
              ...evidenceRows.slice(0, 3).map((e: any) => ({
                ts: String(e.created_at || ""),
                text: `Evidencia subida · ${String((profileById.get(String(e.uploaded_by || "")) as any)?.full_name || "Usuario")}`,
              })),
              ...companiesForActivity.slice(0, 2).map((c: any) => ({
                ts: String(c.created_at || c.updated_at || ""),
                text: `Actividad de empresa · ${String((companyById.get(String(c.id || "")) as any)?.name || "Empresa")}`,
              })),
              ...issues.slice(0, 2).map((i: any) => ({
                ts: String(i.created_at || ""),
                text: "Incidencia operativa registrada.",
              })),
              ...campaigns.slice(0, 2).map((c: any) => ({
                ts: String(c.created_at || ""),
                text: "Campaña de crecimiento lanzada.",
              })),
            ]
              .filter((x) => x.ts)
              .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
              .slice(0, 10)
              .map((item, idx) => (
                <li key={`${item.ts}-${idx}`} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span>{item.text}</span>
                  <span className="text-xs text-slate-500">{new Date(item.ts).toLocaleString("es-ES")}</span>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Perfiles públicos activos: {activePublicProfiles} · Jobs de parsing pendientes: {pendingJobs} · Demos de campañas esta semana: {demosThisWeek}.
          </p>
        </div>
      </Section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Definiciones: usuarios totales salen de auth.users; operación y estados salen de verification_requests/evidences/issue_reports; MRR y churn se derivan de subscriptions activas/canceladas.
      </section>
    </div>
  );
}
