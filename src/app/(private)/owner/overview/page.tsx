import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import type { ReactNode } from "react";

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

function MetricCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
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

export default function OwnerOverviewPage() {
  return <OwnerOverviewServer />;
}

async function OwnerOverviewServer() {
  const supabase = await createClient();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * dayMs;
  const monthAgo = now - 30 * dayMs;

  const [profilesRes, companiesRes, requestsRes, evidenceRes, subscriptionsRes, campaignsRes, jobsRes, publicProfilesRes, issuesRes, employmentRes] = await Promise.all([
    supabase.from("profiles").select("id,role,onboarding_completed,created_at"),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("verification_requests").select("id,status,requested_at,created_at,resolved_at,company_id,requested_by,verification_channel,external_resolved"),
    supabase.from("evidences").select("id,evidence_type,verification_request_id,uploaded_by,created_at"),
    supabase.from("subscriptions").select("id,status,amount,created_at,plan"),
    supabase.from("growth_campaigns").select("*"),
    supabase.from("cv_parse_jobs").select("id,status,created_at"),
    supabase.from("profiles").select("id,public_token,expires_at"),
    supabase.from("issues").select("id,status,created_at"),
    supabase.from("employment_records").select("id,candidate_id,created_at,verification_status"),
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

  const recentActivityCandidateIds = new Set<string>();
  for (const row of employments) {
    const id = String((row as any).candidate_id || "");
    const createdAt = Date.parse(String((row as any).created_at || ""));
    if (id && Number.isFinite(createdAt) && createdAt >= monthAgo && candidateIds.has(id)) {
      recentActivityCandidateIds.add(id);
    }
  }
  for (const row of requests) {
    const id = String((row as any).requested_by || "");
    const ref = Date.parse(String((row as any).requested_at || (row as any).created_at || ""));
    if (id && Number.isFinite(ref) && ref >= monthAgo && candidateIds.has(id)) {
      recentActivityCandidateIds.add(id);
    }
  }
  for (const row of evidenceRows) {
    const id = String((row as any).uploaded_by || "");
    const createdAt = Date.parse(String((row as any).created_at || ""));
    if (id && Number.isFinite(createdAt) && createdAt >= monthAgo && candidateIds.has(id)) {
      recentActivityCandidateIds.add(id);
    }
  }

  const companyIdsFromRequestsLast30 = new Set(
    requests
      .filter((r: any) => {
        const ref = Date.parse(String(r.requested_at || r.created_at || ""));
        return Number.isFinite(ref) && ref >= monthAgo;
      })
      .map((r: any) => String(r.company_id || ""))
      .filter(Boolean)
  );

  const usersTotal = profiles.length;
  const candidatesTotal = candidateProfiles.length;
  const companiesUsersTotal = companyProfiles.length;
  const ownersTotal = ownerProfiles.length;

  const onboardingCompleted = candidateProfiles.filter((p: any) => Boolean(p.onboarding_completed)).length;
  const onboardingPending = candidatesTotal - onboardingCompleted;

  const activeProfiles = recentActivityCandidateIds.size;
  const activeCompanies = companyIdsFromRequestsLast30.size;
  const inactiveCompanies = Math.max(companiesTotal - activeCompanies, 0);

  const verificationsTotal = requests.length;
  const pendingVerifications = requests.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s.includes("pending") || s === "draft";
  }).length;

  const resolvedRows = requests.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s === "verified" || s === "rejected" || s === "revoked";
  });
  const completedVerifications = resolvedRows.length;
  const verifiedVerifications = verifiedRows.length;
  const rejectedVerifications = requests.filter((r: any) => String(r.status || "").toLowerCase() === "rejected").length;
  const revokedVerifications = requests.filter((r: any) => String(r.status || "").toLowerCase() === "revoked").length;

  const requestsThisWeek = requests.filter((r: any) => {
    const ref = Date.parse(String(r.requested_at || r.created_at || ""));
    return Number.isFinite(ref) && ref >= weekAgo;
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
  const evidencesInReviewProxy = evidencesUnlinked;

  const subscriptionsActive = subscriptions.filter((s: any) => {
    const st = String(s.status || "").toLowerCase();
    return st === "active" || st === "trialing";
  });

  const totalMrr = subscriptionsActive.reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;

  const candidateMrr =
    subscriptionsActive
      .filter((row: any) => String(row.plan || "").toLowerCase().includes("candidate"))
      .reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;

  const companyMrr =
    subscriptionsActive
      .filter((row: any) => {
        const plan = String(row.plan || "").toLowerCase();
        return plan.includes("company") || plan.includes("enterprise");
      })
      .reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;

  const oneOffRevenueProxy =
    subscriptions
      .filter((row: any) => {
        const plan = String(row.plan || "").toLowerCase();
        return plan.includes("payg") || plan.includes("one") || plan.includes("usage");
      })
      .reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;

  const activeCampaigns = campaigns.filter((row: any) => String(row.status || "").toLowerCase() === "running").length;
  const weekCampaigns = campaigns.filter((row: any) => {
    const created = Date.parse(String(row.created_at || ""));
    return Number.isFinite(created) && created >= weekAgo;
  });
  const leadsThisWeek = weekCampaigns.reduce((acc: number, row: any) => acc + Number(row.leads_discovered || 0), 0);
  const demosThisWeek = weekCampaigns.reduce((acc: number, row: any) => acc + Number(row.demos_count || 0), 0);

  const failedJobs = jobs.filter((j: any) => String(j.status || "").toLowerCase() === "failed").length;
  const pendingJobs = jobs.filter((j: any) => String(j.status || "").toLowerCase().includes("pending")).length;

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

  if (alerts.length === 0) {
    alerts.push({
      id: "healthy",
      severity: "low",
      title: "Sin alertas críticas",
      detail: "No se detectan anomalías severas con los umbrales actuales.",
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Owner Control Center</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cockpit ejecutivo para seguir activación, operación, calidad de verificación y economía del negocio.
        </p>
      </section>

      <Section title="North Star" subtitle="Estado del negocio en una lectura de 3 segundos.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Perfiles activos"
            value={String(activeProfiles)}
            note={`Base candidatos: ${candidatesTotal} · onboarding: ${onboardingCompleted}`}
          />
          <MetricCard
            title="Empresas activas"
            value={String(activeCompanies)}
            note={`${inactiveCompanies} inactivas (proxy últimos 30 días)`}
          />
          <MetricCard
            title="Verificaciones totales"
            value={String(verificationsTotal)}
            note={`${requestsThisWeek} esta semana · ${pendingVerifications} pendientes`}
          />
          <MetricCard
            title="MRR"
            value={money(totalMrr)}
            note={`${subscriptionsActive.length} suscripciones activas`}
          />
        </div>
      </Section>

      <Section
        title="Funnel de activación"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard title="Verificaciones pendientes" value={String(pendingVerifications)} note="Estados draft/pending" />
            <MetricCard title="Evidencias en revisión" value={String(evidencesInReviewProxy)} note="Proxy: evidencias sin vínculo directo" />
            <MetricCard title="Empresas nuevas (7 días)" value={String(companyProfilesCreatedWeek)} note="Alta reciente de perfiles empresa" />
            <MetricCard title="Casos manuales abiertos" value={String(openIssues + failedJobs)} note={`Incidencias ${openIssues} · jobs fallidos ${failedJobs}`} />
          </div>
        </Section>

        <Section
          title="Calidad del sistema"
          subtitle="Salud de verificación: volumen, éxito, tiempos y carga de revisión."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard title="Ratio éxito" value={`${verificationSuccessRate}%`} note="Verified / resueltas" />
            <MetricCard
              title="Tiempo medio verificación"
              value={avgVerificationHours !== null ? `${avgVerificationHours}h` : "—"}
              note="Desde solicitud hasta resolución"
            />
            <MetricCard title="Verificaciones rechazadas" value={String(rejectedVerifications)} note={`Revocadas ${revokedVerifications}`} />
            <MetricCard title="Automática vs manual" value={`${completedVerifications - pendingVerifications} / ${pendingVerifications}`} note="Proxy operativo del flujo actual" />
          </div>
        </Section>
      </div>

      <Section
        title="Economía del negocio"
        subtitle="Composición de ingresos y ritmo de monetización actual."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="MRR total" value={money(totalMrr)} note="Suscripciones activas/trialing" />
          <MetricCard title="MRR candidatos" value={money(candidateMrr)} note="Planes candidate_*" />
          <MetricCard title="MRR empresas" value={money(companyMrr)} note="Planes company/enterprise" />
          <MetricCard title="Ingresos one-off (proxy)" value={money(oneOffRevenueProxy)} note="Planes usage/payg detectados" />
        </div>
      </Section>

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

      <Section
        title="Quick actions"
        subtitle="Accesos rápidos para ejecutar soporte, operación y crecimiento."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Link href="/owner/users" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Ver usuarios
            <span className="mt-1 block text-xs font-normal text-slate-500">{usersTotal} usuarios totales</span>
          </Link>
          <Link href="/owner/companies" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Ver empresas
            <span className="mt-1 block text-xs font-normal text-slate-500">{companiesTotal} empresas registradas</span>
          </Link>
          <Link href="/owner/verifications?status=pendiente" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Cola de verificaciones
            <span className="mt-1 block text-xs font-normal text-slate-500">{pendingVerifications} pendientes</span>
          </Link>
          <Link href="/owner/monetization" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Monetización
            <span className="mt-1 block text-xs font-normal text-slate-500">MRR {money(totalMrr)}</span>
          </Link>
          <Link href="/owner/growth" className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
            Growth
            <span className="mt-1 block text-xs font-normal text-blue-100">{activeCampaigns} campañas activas · {leadsThisWeek} leads/semana</span>
          </Link>
        </div>
      </Section>

      <Section
        title="Contexto operativo"
        subtitle="Contexto transversal para soporte y producto sin salir del cockpit."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Perfiles públicos activos" value={String(activePublicProfiles)} note="Tokens públicos no expirados" />
          <MetricCard title="Jobs parsing pendientes" value={String(pendingJobs)} note={`${failedJobs} fallidos`} />
          <MetricCard title="Issues abiertos" value={String(openIssues)} note="Backlog operativo actual" />
          <MetricCard title="Demos semana" value={String(demosThisWeek)} note={`Campañas activas ${activeCampaigns}`} />
        </div>
      </Section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Definiciones de esta versión: “Perfiles activos” y “Empresas activas” usan actividad reciente (30 días) como proxy.
        “Evidencias en revisión” y “ingresos one-off” son aproximaciones operativas hasta disponer de señal dedicada.
      </section>
    </div>
  );
}
