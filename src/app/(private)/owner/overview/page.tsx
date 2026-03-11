import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import type { ReactNode } from "react";
import { OWNER_OVERVIEW_SECTION_TITLES } from "@/lib/owner-overview-config";

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

function money(v: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v);
}

export default function OwnerOverviewPage() {
  return <OwnerOverviewServer />;
}

async function OwnerOverviewServer() {
  const supabase = await createClient();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const [profilesRes, companiesRes, requestsRes, evidenceRes, subscriptionsRes, campaignsRes, jobsRes, publicProfilesRes, issuesRes] = await Promise.all([
    supabase.from("profiles").select("id,role,onboarding_completed,created_at"),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("verification_requests").select("id,status,requested_at,created_at,resolved_at,company_id,requested_by"),
    supabase.from("evidences").select("id,evidence_type,verification_request_id", { count: "exact" }),
    supabase.from("subscriptions").select("id,status,amount,created_at,plan"),
    supabase.from("growth_campaigns").select("*"),
    supabase.from("cv_parse_jobs").select("id,status,created_at"),
    supabase.from("profiles").select("id,public_token,expires_at"),
    supabase.from("issues").select("id,status,created_at"),
  ]);

  const profiles = Array.isArray(profilesRes.data) ? profilesRes.data : [];
  const usersTotal = profiles.length;
  const companiesTotal = Number(companiesRes.count || 0);
  const candidatesTotal = profiles.filter((p: any) => String(p.role || "").toLowerCase() === "candidate").length;
  const companiesUsersTotal = profiles.filter((p: any) => String(p.role || "").toLowerCase() === "company").length;
  const ownersTotal = profiles.filter((p: any) => {
    const r = String(p.role || "").toLowerCase();
    return r === "owner" || r === "admin";
  }).length;
  const onboardingCompleted = profiles.filter((p: any) => Boolean(p.onboarding_completed)).length;
  const onboardingPending = usersTotal - onboardingCompleted;

  const requests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
  const verificationsTotal = requests.length;
  const resolvedRows = requests.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s === "verified" || s === "rejected" || s === "revoked";
  });
  const verifiedRows = requests.filter((r: any) => String(r.status || "").toLowerCase() === "verified");
  const completedVerifications = resolvedRows.length;
  const verifiedVerifications = verifiedRows.length;
  const verificationSuccessRate = completedVerifications > 0 ? Math.round((verifiedVerifications / completedVerifications) * 100) : 0;
  const pendingVerifications = requests.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s.includes("request") || s.includes("pending");
  }).length;
  const uniqueVerifiedCandidates = new Set(
    verifiedRows.map((r: any) => String(r.requested_by || "")).filter(Boolean)
  ).size;

  const requestsThisWeek = requests.filter((r: any) => {
    const ref = r.requested_at || r.created_at;
    if (!ref) return false;
    return new Date(ref).getTime() >= weekAgo;
  }).length;

  const activeCompanies = new Set(requests.map((r: any) => r.company_id).filter(Boolean)).size;
  const inactiveCompanies = companiesTotal
    ? companiesTotal - activeCompanies
    : 0;
  const resolutionHours = resolvedRows
    .map((row: any) => {
      const start = Date.parse(String(row.requested_at || row.created_at || ""));
      const end = Date.parse(String(row.resolved_at || ""));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return (end - start) / (1000 * 60 * 60);
    })
    .filter((v: number | null): v is number => typeof v === "number" && Number.isFinite(v));
  const avgVerificationHours = resolutionHours.length
    ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
    : null;

  const evidenceRows = Array.isArray(evidenceRes.data) ? evidenceRes.data : [];
  const evidencesTotal = Number(evidenceRes.count || evidenceRows.length || 0);
  const evidencesUnlinked = evidenceRows.filter((e: any) => !e.verification_request_id).length;
  const evidencesLinked = evidencesTotal - evidencesUnlinked;

  const subscriptions = Array.isArray(subscriptionsRes.data) ? subscriptionsRes.data : [];
  const activeSubs = subscriptions.filter((s: any) => {
    const st = String(s.status || "").toLowerCase();
    return st === "active" || st === "trialing";
  });
  const mrr = activeSubs.reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;

  const campaigns = Array.isArray(campaignsRes.data) ? campaignsRes.data : [];
  const activeCampaigns = campaigns.filter((row: any) => String(row.status || "").toLowerCase() === "running").length;
  const weekCampaigns = campaigns.filter((row: any) => row.created_at && new Date(row.created_at).getTime() >= weekAgo);
  const leadsThisWeek = weekCampaigns.reduce((acc: number, row: any) => acc + Number(row.leads_discovered || 0), 0);
  const demosThisWeek = weekCampaigns.reduce((acc: number, row: any) => acc + Number(row.demos_count || 0), 0);
  const totalCampaignCost = campaigns.reduce((acc: number, row: any) => {
    return acc + Number(row.cost_scraping || 0) + Number(row.cost_enrichment || 0) + Number(row.cost_sending || 0) + Number(row.cost_infra || 0);
  }, 0);

  const queuedCampaigns = campaigns.filter((row: any) => String(row.execution_status || "").toLowerCase() === "queued").length;
  const runningCampaigns = campaigns.filter((row: any) => String(row.execution_status || "").toLowerCase() === "running").length;
  const failedCampaigns = campaigns.filter((row: any) => String(row.execution_status || "").toLowerCase() === "failed").length;
  const completedCampaigns = campaigns.filter((row: any) => String(row.execution_status || "").toLowerCase() === "completed").length;

  const outOfSyncCampaigns = campaigns.filter((row: any) => {
    const status = String(row.execution_status || "idle").toLowerCase();
    if (!["queued", "running", "paused"].includes(status)) return false;
    if (!row.last_sync_at) return true;
    return new Date(row.last_sync_at).getTime() < Date.now() - 24 * 60 * 60 * 1000;
  }).length;
  const failedSyncs = campaigns.filter((row: any) => Boolean(row.last_provider_error)).length;
  const syncedToday = campaigns.filter((row: any) => {
    if (!row.last_sync_at) return false;
    return new Date(row.last_sync_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
  }).length;

  const configuredOutscraper = campaigns.filter((row: any) => {
    const config = row.provider_scraping_config;
    return config && typeof config === "object" && Object.keys(config).length > 0;
  }).length;
  const importedOutscraper = campaigns.filter((row: any) => String(row.provider_scraping_last_status || "").toLowerCase() === "imported").length;
  const scrapingFailures = campaigns.filter((row: any) => String(row.provider_scraping_last_status || "").toLowerCase() === "failed" || Boolean(row.last_provider_error)).length;
  const totalScrapingCost = campaigns.reduce((acc: number, row: any) => acc + Number(row.provider_scraping_last_cost || 0), 0);

  const jobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
  const failedJobs = jobs.filter((j: any) => String(j.status || "").toLowerCase() === "failed").length;
  const pendingJobs = jobs.filter((j: any) => String(j.status || "").toLowerCase().includes("pending")).length;
  const errorRate = jobs.length ? Math.round((failedJobs / jobs.length) * 100) : 0;
  const openIssues = (Array.isArray(issuesRes.data) ? issuesRes.data : []).filter((i: any) => {
    const st = String(i.status || "").toLowerCase();
    return st !== "closed" && st !== "resolved" && st !== "done";
  }).length;
  const publicProfiles = (Array.isArray(publicProfilesRes.data) ? publicProfilesRes.data : []).filter((p: any) => {
    if (!p.public_token) return false;
    if (!p.expires_at) return true;
    const ts = Date.parse(String(p.expires_at));
    return Number.isFinite(ts) ? ts > Date.now() : true;
  }).length;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Owner Control Center</h1>
        <p className="mt-1 text-sm text-slate-600">
          Panel ejecutivo para decisión rápida en operaciones, crecimiento, verificaciones y monetización.
        </p>
      </section>

      <Section title={OWNER_OVERVIEW_SECTION_TITLES[0]} subtitle="Lectura ejecutiva de adopción, activación y monetización.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Users total" value={String(usersTotal)} note={`Candidatos ${candidatesTotal} · Empresa ${companiesUsersTotal} · Owner ${ownersTotal}`} />
          <MetricCard title="Companies" value={String(companiesTotal)} note={`${activeCompanies} activas · ${inactiveCompanies} inactivas`} />
          <MetricCard title="Verifications" value={String(verificationsTotal)} note={`${requestsThisWeek} solicitadas esta semana`} />
          <MetricCard title="MRR" value={money(mrr)} note={`${activeSubs.length} suscripciones activas`} />
        </div>
      </Section>

      <Section title={OWNER_OVERVIEW_SECTION_TITLES[1]} subtitle="Capacidad de convertir registro en perfil operativo.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Onboarding completado" value={String(onboardingCompleted)} note={`${onboardingPending} pendientes`} />
          <MetricCard title="Perfiles públicos activos" value={String(publicProfiles)} note="Token público no expirado" />
          <MetricCard title="Empresas activas" value={String(activeCompanies)} note="Con solicitudes de verificación" />
          <MetricCard title="Candidatos con verificación OK" value={String(uniqueVerifiedCandidates)} note="Al menos una verificación en estado verified" />
        </div>
      </Section>

      <Section title={OWNER_OVERVIEW_SECTION_TITLES[2]} subtitle="Calidad del motor de verificación y señal resultante.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Pending verifications" value={String(pendingVerifications)} />
          <MetricCard title="Completadas" value={String(completedVerifications)} note={`${verifiedVerifications} verificadas`} />
          <MetricCard title="Ratio de éxito" value={`${verificationSuccessRate}%`} note="Verified / completadas" />
          <MetricCard title="Tiempo medio verificación" value={avgVerificationHours !== null ? `${avgVerificationHours}h` : "—"} note="De solicitud a resolución" />
          <MetricCard title="Evidencias" value={String(evidencesTotal)} note={`${evidencesLinked} vinculadas · ${evidencesUnlinked} sin vincular`} />
        </div>
      </Section>

      <Section title={OWNER_OVERVIEW_SECTION_TITLES[3]} subtitle="Salud técnica y estado del trabajo operativo.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Error rate parsing" value={`${errorRate}%`} note={`${failedJobs} jobs fallidos`} />
          <MetricCard title="CV parsing jobs" value={String(jobs.length)} note={`${pendingJobs} pendientes`} />
          <MetricCard title="Incidencias abiertas" value={String(openIssues)} />
          <MetricCard title="Campaigns running" value={String(activeCampaigns)} note={`Leads semana ${leadsThisWeek} · demos ${demosThisWeek} · coste ${money(totalCampaignCost)}`} />
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Execution Health" subtitle="Estado de ejecución de campañas.">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard title="Queued" value={String(queuedCampaigns)} />
            <MetricCard title="Running" value={String(runningCampaigns)} />
            <MetricCard title="Failed" value={String(failedCampaigns)} />
            <MetricCard title="Completed" value={String(completedCampaigns)} />
          </div>
        </Section>

        <Section title="Provider Health" subtitle="Sincronización y salud de proveedores.">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard title="Out of sync" value={String(outOfSyncCampaigns)} />
            <MetricCard title="Failed syncs" value={String(failedSyncs)} />
            <MetricCard title="Synced today" value={String(syncedToday)} />
          </div>
        </Section>
      </div>

      <Section title="Scraping Health" subtitle="Rendimiento actual del conector de scraping.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Outscraper configured" value={String(configuredOutscraper)} />
          <MetricCard title="Imported campaigns" value={String(importedOutscraper)} />
          <MetricCard title="Scraping failures" value={String(scrapingFailures)} />
          <MetricCard title="Scraping cost" value={money(totalScrapingCost)} />
        </div>
      </Section>

      <Section title="Quick Actions" subtitle="Accesos directos para la operación diaria del founder/admin.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Link href="/owner/issues" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Incidencias abiertas
            <span className="mt-1 block text-xs font-normal text-slate-500">{failedJobs} jobs fallidos</span>
          </Link>
          <Link href="/owner/companies?activity=inactive" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Empresas sin actividad
            <span className="mt-1 block text-xs font-normal text-slate-500">{inactiveCompanies} detectadas</span>
          </Link>
          <Link href="/owner/verifications?status=pendiente" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Verificaciones pendientes
            <span className="mt-1 block text-xs font-normal text-slate-500">{pendingVerifications} por revisar</span>
          </Link>
          <Link href="/owner/monetization" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Revisar monetización
            <span className="mt-1 block text-xs font-normal text-slate-500">MRR {money(mrr)}</span>
          </Link>
          <Link href="/owner/growth" className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
            Lanzar campaign
            <span className="mt-1 block text-xs font-normal text-blue-100">{activeCampaigns} activas</span>
          </Link>
        </div>
      </Section>
    </div>
  );
}
