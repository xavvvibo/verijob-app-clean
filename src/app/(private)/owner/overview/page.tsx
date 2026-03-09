import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function MetricCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </article>
  );
}

export default function OwnerOverviewPage() {
  return <OwnerOverviewServer />;
}

async function OwnerOverviewServer() {
  const supabase = await createClient();
  const now = Date.now();
  const weekAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: campaigns } = await supabase
    .from("growth_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = Array.isArray(campaigns) ? campaigns : [];
  const activeCampaigns = rows.filter((row) => String(row.status || "").toLowerCase() === "running").length;
  const weekRows = rows.filter((row) => new Date(row.created_at).getTime() >= new Date(weekAgoIso).getTime());
  const leadsThisWeek = weekRows.reduce((acc, row) => acc + Number(row.leads_discovered || 0), 0);
  const demosThisWeek = weekRows.reduce((acc, row) => acc + Number(row.demos_count || 0), 0);
  const totalCampaignCost = rows.reduce((acc, row) => {
    return (
      acc +
      Number(row.cost_scraping || 0) +
      Number(row.cost_enrichment || 0) +
      Number(row.cost_sending || 0) +
      Number(row.cost_infra || 0)
    );
  }, 0);
  const queuedCampaigns = rows.filter((row) => String(row.execution_status || "idle").toLowerCase() === "queued").length;
  const runningCampaigns = rows.filter((row) => String(row.execution_status || "idle").toLowerCase() === "running").length;
  const failedCampaigns = rows.filter((row) => String(row.execution_status || "idle").toLowerCase() === "failed").length;
  const completedCampaigns = rows.filter((row) => String(row.execution_status || "idle").toLowerCase() === "completed").length;
  const outOfSyncCampaigns = rows.filter((row) => {
    const status = String(row.execution_status || "idle").toLowerCase();
    if (!["queued", "running", "paused"].includes(status)) return false;
    if (!row.last_sync_at) return true;
    return new Date(row.last_sync_at).getTime() < Date.now() - 24 * 60 * 60 * 1000;
  }).length;
  const failedSyncs = rows.filter((row) => Boolean(row.last_provider_error)).length;
  const syncedToday = rows.filter((row) => {
    if (!row.last_sync_at) return false;
    return new Date(row.last_sync_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
  }).length;
  const configuredOutscraper = rows.filter((row) => {
    const config = row.provider_scraping_config;
    return config && typeof config === "object" && Object.keys(config).length > 0;
  }).length;
  const importedOutscraper = rows.filter(
    (row) => String(row.provider_scraping_last_status || "").toLowerCase() === "imported"
  ).length;
  const scrapingFailures = rows.filter(
    (row) =>
      String(row.provider_scraping_last_status || "").toLowerCase() === "failed" || Boolean(row.last_provider_error)
  ).length;
  const totalScrapingCost = rows.reduce((acc, row) => acc + Number(row.provider_scraping_last_cost || 0), 0);

  const money = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(totalCampaignCost);
  const scrapingMoney = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(totalScrapingCost);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Owner Control Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Vista operativa para crecimiento, marketing, salud del sistema y acciones rápidas.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Key Metrics</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Users total" value="—" note="Conecta KPI real en iteración siguiente" />
          <MetricCard title="Companies" value="—" note="Conecta KPI real en iteración siguiente" />
          <MetricCard title="Verifications" value="—" note="Conecta KPI real en iteración siguiente" />
          <MetricCard title="MRR" value="—" note="Placeholder hasta Stripe LIVE definitivo" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">System Health</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Error rate" value="—" />
          <MetricCard title="Pending verifications" value="—" />
          <MetricCard title="Evidence pending" value="—" />
          <MetricCard title="CV parsing jobs" value="—" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Growth Economics</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Active campaigns" value={String(activeCampaigns)} />
          <MetricCard title="Leads generated this week" value={String(leadsThisWeek)} />
          <MetricCard title="Demos booked this week" value={String(demosThisWeek)} />
          <MetricCard title="Total campaign cost" value={money} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Execution Health</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Queued campaigns" value={String(queuedCampaigns)} />
          <MetricCard title="Running campaigns" value={String(runningCampaigns)} />
          <MetricCard title="Failed campaigns" value={String(failedCampaigns)} />
          <MetricCard title="Completed campaigns" value={String(completedCampaigns)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Provider Health</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <MetricCard title="Campaigns out of sync" value={String(outOfSyncCampaigns)} />
          <MetricCard title="Failed syncs" value={String(failedSyncs)} />
          <MetricCard title="Synced today" value={String(syncedToday)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Scraping Health</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Campaigns with Outscraper configured" value={String(configuredOutscraper)} />
          <MetricCard title="Campaigns imported" value={String(importedOutscraper)} />
          <MetricCard title="Scraping failures" value={String(scrapingFailures)} />
          <MetricCard title="Total scraping cost" value={scrapingMoney} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Quick Actions</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Link href="/owner/growth" className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800">
            Launch Growth Campaign
          </Link>
          <Link href="/owner/marketing" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
            Create Promo Code
          </Link>
          <Link href="/owner/issues" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
            Review Issues
          </Link>
        </div>
      </section>
    </div>
  );
}
