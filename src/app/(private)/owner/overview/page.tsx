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
    supabase.from("verification_requests").select("id,status,requested_at"),
    supabase.from("evidences").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id,status,amount,created_at"),
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

  const evidencesTotal = Number(evidenceRes.count || 0);

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
  const errorRate = jobs.length ? Math.round((jobs.filter((j: any) => String(j.status || "").toLowerCase() === "failed").length / jobs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Owner Control Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Centro operativo para crecimiento, marketing, monetización y salud de plataforma con datos internos en tiempo real.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Key Metrics</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Users total" value={String(usersTotal)} />
          <MetricCard title="Companies" value={String(companiesTotal)} />
          <MetricCard title="Verifications" value={String(verificationsTotal)} />
          <MetricCard title="MRR" value={money(mrr)} note="Stripe LIVE conectado en subscriptions" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">System Health</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Error rate" value={`${errorRate}%`} />
          <MetricCard title="Pending verifications" value={String(pendingVerifications)} />
          <MetricCard title="Evidence volume" value={String(evidencesTotal)} />
          <MetricCard title="CV parsing jobs" value={String(jobs.length)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Growth Economics</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Active campaigns" value={String(activeCampaigns)} />
          <MetricCard title="Leads generated this week" value={String(leadsThisWeek)} />
          <MetricCard title="Demos booked this week" value={String(demosThisWeek)} />
          <MetricCard title="Total campaign cost" value={money(totalCampaignCost)} />
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
          <MetricCard title="Outscraper configured" value={String(configuredOutscraper)} />
          <MetricCard title="Imported campaigns" value={String(importedOutscraper)} />
          <MetricCard title="Scraping failures" value={String(scrapingFailures)} />
          <MetricCard title="Total scraping cost" value={money(totalScrapingCost)} />
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
