import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import type { ReactNode } from "react";

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

  const [profilesRes, companiesRes, requestsRes, evidenceRes, subscriptionsRes, campaignsRes, jobsRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("verification_requests").select("id,status,requested_at,company_id"),
    supabase.from("evidences").select("id,evidence_type,verification_request_id", { count: "exact" }),
    supabase.from("subscriptions").select("id,status,amount,created_at,plan"),
    supabase.from("growth_campaigns").select("*"),
    supabase.from("cv_parse_jobs").select("id,status,created_at"),
  ]);

  const usersTotal = Number(profilesRes.count || 0);
  const companiesTotal = Number(companiesRes.count || 0);

  const requests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
  const verificationsTotal = requests.length;
  const pendingVerifications = requests.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s.includes("request") || s.includes("pending");
  }).length;

  const requestsThisWeek = requests.filter((r: any) => {
    if (!r.requested_at) return false;
    return new Date(r.requested_at).getTime() >= weekAgo;
  }).length;

  const inactiveCompanies = companiesTotal
    ? companiesTotal - new Set(requests.map((r: any) => r.company_id).filter(Boolean)).size
    : 0;

  const evidenceRows = Array.isArray(evidenceRes.data) ? evidenceRes.data : [];
  const evidencesTotal = Number(evidenceRes.count || evidenceRows.length || 0);
  const evidencesUnlinked = evidenceRows.filter((e: any) => !e.verification_request_id).length;

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

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Owner Control Center</h1>
        <p className="mt-1 text-sm text-slate-600">
          Panel ejecutivo para decisión rápida en operaciones, crecimiento, verificaciones y monetización.
        </p>
      </section>

      <Section title="Key Metrics" subtitle="Lectura principal de negocio y actividad en plataforma.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Users total" value={String(usersTotal)} />
          <MetricCard title="Companies" value={String(companiesTotal)} note={`${inactiveCompanies} sin actividad`} />
          <MetricCard title="Verifications" value={String(verificationsTotal)} note={`${requestsThisWeek} esta semana`} />
          <MetricCard title="MRR" value={money(mrr)} note={`${activeSubs.length} suscripciones activas`} />
        </div>
      </Section>

      <Section title="System Health" subtitle="Estado operativo de verificaciones, evidencias y parsing.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Error rate" value={`${errorRate}%`} note={`${failedJobs} fallidos`} />
          <MetricCard title="Pending verifications" value={String(pendingVerifications)} />
          <MetricCard title="Evidence volume" value={String(evidencesTotal)} note={`${evidencesUnlinked} sin vinculación`} />
          <MetricCard title="CV parsing jobs" value={String(jobs.length)} note={`${pendingJobs} pendientes`} />
        </div>
      </Section>

      <Section title="Growth Economics" subtitle="Coste y rendimiento agregado de campañas.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Active campaigns" value={String(activeCampaigns)} />
          <MetricCard title="Leads this week" value={String(leadsThisWeek)} />
          <MetricCard title="Demos this week" value={String(demosThisWeek)} />
          <MetricCard title="Total campaign cost" value={money(totalCampaignCost)} />
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
