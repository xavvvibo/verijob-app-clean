"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Campaign = {
  id: string;
  objective: string;
  sector: string;
  location_scope: string;
  location_value: string | null;
  company_size: string;
  channel: string;
  intensity: string;
  message_style: string;
  template_key: string | null;
  status: string;
  created_at: string;
  launched_at?: string | null;
  execution_status?: string | null;
  provider_scraping?: string | null;
  provider_enrichment?: string | null;
  provider_sending?: string | null;
  external_job_id?: string | null;
  provider_scraping_config?: Record<string, any> | null;
  provider_scraping_job_id?: string | null;
  provider_scraping_last_status?: string | null;
  provider_scraping_last_result?: Record<string, any> | null;
  provider_scraping_last_cost?: number | null;
  provider_scraping_last_leads?: number | null;
  last_sync_at?: string | null;
  execution_started_at?: string | null;
  execution_finished_at?: string | null;
  last_provider_payload?: Record<string, any> | null;
  last_provider_error?: string | null;
  sync_attempts?: number;
  next_sync_at?: string | null;
  leads_discovered: number;
  contacts_found: number;
  messages_queued: number;
  replies_count: number;
  demos_count: number;
  cost_scraping: number;
  cost_enrichment: number;
  cost_sending: number;
  cost_infra: number;
  customers_converted: number;
  outcome_note?: string | null;
  total_cost?: number;
  cost_per_lead?: number;
  cost_per_demo?: number;
  cost_per_customer?: number;
};

function money(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function calcEconomics(campaign: Campaign) {
  if (
    typeof campaign.total_cost === "number" &&
    typeof campaign.cost_per_lead === "number" &&
    typeof campaign.cost_per_demo === "number" &&
    typeof campaign.cost_per_customer === "number"
  ) {
    return {
      costScraping: Number(campaign.cost_scraping || 0),
      costEnrichment: Number(campaign.cost_enrichment || 0),
      costSending: Number(campaign.cost_sending || 0),
      costInfra: Number(campaign.cost_infra || 0),
      totalCost: Number(campaign.total_cost || 0),
      costPerLead: Number(campaign.cost_per_lead || 0),
      costPerDemo: Number(campaign.cost_per_demo || 0),
      costPerCustomer: Number(campaign.cost_per_customer || 0),
    };
  }

  const costScraping = Number(campaign.cost_scraping || 0);
  const costEnrichment = Number(campaign.cost_enrichment || 0);
  const costSending = Number(campaign.cost_sending || 0);
  const costInfra = Number(campaign.cost_infra || 0);
  const totalCost = costScraping + costEnrichment + costSending + costInfra;

  const leads = Number(campaign.leads_discovered || 0);
  const demos = Number(campaign.demos_count || 0);
  const customers = Number(campaign.customers_converted || 0);

  return {
    costScraping,
    costEnrichment,
    costSending,
    costInfra,
    totalCost,
    costPerLead: leads > 0 ? totalCost / leads : 0,
    costPerDemo: demos > 0 ? totalCost / demos : 0,
    costPerCustomer: customers > 0 ? totalCost / customers : 0,
  };
}

function kpiLabel(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "N/A";
  return money(value);
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

function campaignSuccess(campaign: Campaign) {
  const demos = Number(campaign.demos_count || 0);
  const customers = Number(campaign.customers_converted || 0);
  const replies = Number(campaign.replies_count || 0);
  const leads = Number(campaign.leads_discovered || 0);

  if (demos >= 3 || customers >= 1) return "Positive";
  if (replies > 0 && demos < 3 && customers === 0) return "Neutral";
  if (replies === 0 || leads === 0) return "Negative";
  return "Neutral";
}

export default function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [savingCosts, setSavingCosts] = useState(false);
  const [savingExecution, setSavingExecution] = useState(false);
  const [savingOutscraper, setSavingOutscraper] = useState(false);
  const [costForm, setCostForm] = useState({
    cost_scraping: "0",
    cost_enrichment: "0",
    cost_sending: "0",
    cost_infra: "0",
    customers_converted: "0",
    outcome_note: "",
  });
  const [executionForm, setExecutionForm] = useState({
    provider_scraping: "",
    provider_enrichment: "",
    provider_sending: "",
    external_job_id: "",
  });
  const [outscraperForm, setOutscraperForm] = useState({
    search_query: "",
    country: "",
    city: "",
    limit: "100",
    source_type: "google_maps",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/internal/owner/growth/campaigns/${campaignId}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "No se pudo cargar la campaña");
        if (alive) {
          const next = json?.campaign || null;
          setCampaign(next);
          if (next) {
            setCostForm({
              cost_scraping: String(Number(next.cost_scraping || 0)),
              cost_enrichment: String(Number(next.cost_enrichment || 0)),
              cost_sending: String(Number(next.cost_sending || 0)),
              cost_infra: String(Number(next.cost_infra || 0)),
              customers_converted: String(Number(next.customers_converted || 0)),
              outcome_note: String(next.outcome_note || ""),
            });
            setExecutionForm({
              provider_scraping: String(next.provider_scraping || ""),
              provider_enrichment: String(next.provider_enrichment || ""),
              provider_sending: String(next.provider_sending || ""),
              external_job_id: String(next.external_job_id || ""),
            });
            const config = next.provider_scraping_config || {};
            setOutscraperForm({
              search_query: String(config.search_query || ""),
              country: String(config.country || ""),
              city: String(config.city || ""),
              limit: String(Number(config.limit || 100)),
              source_type: String(config.source_type || "google_maps"),
            });
          }
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "No se pudo cargar la campaña");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [campaignId]);

  async function saveCosts(e: React.FormEvent) {
    e.preventDefault();
    if (!campaign) return;
    setSavingCosts(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/owner/growth/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update_costs",
          cost_scraping: Number(costForm.cost_scraping || 0),
          cost_enrichment: Number(costForm.cost_enrichment || 0),
          cost_sending: Number(costForm.cost_sending || 0),
          cost_infra: Number(costForm.cost_infra || 0),
          customers_converted: Number(costForm.customers_converted || 0),
          outcome_note: costForm.outcome_note || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudieron guardar los costes");
      const next = json?.campaign || null;
      if (next) {
        setCampaign(next);
        setCostForm({
          cost_scraping: String(Number(next.cost_scraping || 0)),
          cost_enrichment: String(Number(next.cost_enrichment || 0)),
          cost_sending: String(Number(next.cost_sending || 0)),
          cost_infra: String(Number(next.cost_infra || 0)),
          customers_converted: String(Number(next.customers_converted || 0)),
          outcome_note: String(next.outcome_note || ""),
        });
      }
    } catch (e: any) {
      setError(e?.message || "No se pudieron guardar los costes");
    } finally {
      setSavingCosts(false);
    }
  }

  async function saveExecution(e: React.FormEvent) {
    e.preventDefault();
    if (!campaign) return;
    setSavingExecution(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/owner/growth/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update_execution",
          provider_scraping: executionForm.provider_scraping || null,
          provider_enrichment: executionForm.provider_enrichment || null,
          provider_sending: executionForm.provider_sending || null,
          external_job_id: executionForm.external_job_id || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo guardar setup de ejecución");
      const next = json?.campaign || null;
      if (next) {
        setCampaign(next);
        setExecutionForm({
          provider_scraping: String(next.provider_scraping || ""),
          provider_enrichment: String(next.provider_enrichment || ""),
          provider_sending: String(next.provider_sending || ""),
          external_job_id: String(next.external_job_id || ""),
        });
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar setup de ejecución");
    } finally {
      setSavingExecution(false);
    }
  }

  function applyCampaign(next: Campaign | null) {
    if (!next) return;
    setCampaign(next);
    setExecutionForm({
      provider_scraping: String(next.provider_scraping || ""),
      provider_enrichment: String(next.provider_enrichment || ""),
      provider_sending: String(next.provider_sending || ""),
      external_job_id: String(next.external_job_id || ""),
    });
    const config = next.provider_scraping_config || {};
    setOutscraperForm({
      search_query: String(config.search_query || ""),
      country: String(config.country || ""),
      city: String(config.city || ""),
      limit: String(Number(config.limit || 100)),
      source_type: String(config.source_type || "google_maps"),
    });
  }

  async function runOutscraperAction(action: string, extra: Record<string, any> = {}) {
    if (!campaign) return;
    setSavingOutscraper(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/owner/growth/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `No se pudo ejecutar ${action}`);
      applyCampaign(json?.campaign || null);
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar Outscraper");
    } finally {
      setSavingOutscraper(false);
    }
  }

  async function saveOutscraperConfig(e: React.FormEvent) {
    e.preventDefault();
    await runOutscraperAction("save_outscraper_config", {
      provider_scraping_config: {
        search_query: outscraperForm.search_query || "",
        country: outscraperForm.country || "",
        city: outscraperForm.city || "",
        limit: Number(outscraperForm.limit || 0),
        source_type: outscraperForm.source_type || "google_maps",
      },
    });
  }

  async function importSampleOutscraper() {
    await runOutscraperAction("import_outscraper_result", {
      payload: {
        job_id: `outscraper_job_${campaignId.slice(0, 6)}`,
        status: "completed",
        cost: 12.5,
        leads: 84,
        contacts_found: 51,
        source: outscraperForm.source_type || "google_maps",
        query: outscraperForm.search_query || "asesorias laborales granada",
      },
    });
  }

  const economics = useMemo(() => {
    if (!campaign) return null;
    return calcEconomics(campaign);
  }, [campaign]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">Cargando detalle de campaña...</div>;
  }

  if (error || !campaign || !economics) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error || "No se encontró la campaña"}</div>
        <Link href="/owner/growth" className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
          Volver a Growth
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Campaign Info</h1>
            <p className="mt-2 text-sm text-slate-600">
              {campaign.objective} · {campaign.sector} · {campaign.location_value || campaign.location_scope}
            </p>
            <p className="mt-1 text-xs text-slate-500">ID: {campaign.id}</p>
          </div>
          <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {campaign.status}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              campaignSuccess(campaign) === "Positive"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : campaignSuccess(campaign) === "Neutral"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {campaignSuccess(campaign)}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Performance</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Leads discovered" value={campaign.leads_discovered || 0} />
          <MetricCard label="Contacts found" value={campaign.contacts_found || 0} />
          <MetricCard label="Messages sent" value={campaign.messages_queued || 0} />
          <MetricCard label="Replies" value={campaign.replies_count || 0} />
          <MetricCard label="Demos booked" value={campaign.demos_count || 0} />
          <MetricCard label="Customers converted" value={campaign.customers_converted || 0} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Cost Breakdown</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Scraping" value={money(economics.costScraping)} />
          <MetricCard label="Enrichment" value={money(economics.costEnrichment)} />
          <MetricCard label="Sending" value={money(economics.costSending)} />
          <MetricCard label="Infra" value={money(economics.costInfra)} />
          <MetricCard label="Total" value={money(economics.totalCost)} />
        </div>

        <form onSubmit={saveCosts} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CostInput
            label="Scraping cost"
            value={costForm.cost_scraping}
            onChange={(value) => setCostForm((s) => ({ ...s, cost_scraping: value }))}
          />
          <CostInput
            label="Enrichment cost"
            value={costForm.cost_enrichment}
            onChange={(value) => setCostForm((s) => ({ ...s, cost_enrichment: value }))}
          />
          <CostInput
            label="Sending cost"
            value={costForm.cost_sending}
            onChange={(value) => setCostForm((s) => ({ ...s, cost_sending: value }))}
          />
          <CostInput
            label="Infrastructure cost"
            value={costForm.cost_infra}
            onChange={(value) => setCostForm((s) => ({ ...s, cost_infra: value }))}
          />
          <CostInput
            label="Customers converted"
            value={costForm.customers_converted}
            onChange={(value) => setCostForm((s) => ({ ...s, customers_converted: value }))}
            step="1"
          />
          <label className="block md:col-span-2 xl:col-span-3">
            <span className="text-sm font-medium text-slate-700">Outcome note</span>
            <textarea
              value={costForm.outcome_note}
              onChange={(e) => setCostForm((s) => ({ ...s, outcome_note: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="Resumen manual de resultado de campaña"
            />
          </label>
          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingCosts}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {savingCosts ? "Guardando..." : "Save Economics"}
            </button>
            <button
              type="submit"
              disabled={savingCosts}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              {savingCosts ? "Guardando..." : "Save Outcome"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Provider Sync</h2>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="execution_status" value={campaign.execution_status || "idle"} />
          <Row label="external_job_id" value={campaign.external_job_id || "—"} />
          <Row
            label="execution_started_at"
            value={campaign.execution_started_at ? new Date(campaign.execution_started_at).toLocaleString("es-ES") : "—"}
          />
          <Row
            label="execution_finished_at"
            value={campaign.execution_finished_at ? new Date(campaign.execution_finished_at).toLocaleString("es-ES") : "—"}
          />
          <Row
            label="last_sync_at"
            value={campaign.last_sync_at ? new Date(campaign.last_sync_at).toLocaleString("es-ES") : "—"}
          />
          <Row
            label="next_sync_at"
            value={campaign.next_sync_at ? new Date(campaign.next_sync_at).toLocaleString("es-ES") : "—"}
          />
          <Row label="sync_attempts" value={String(campaign.sync_attempts ?? 0)} />
          <Row label="last_provider_error" value={campaign.last_provider_error || "—"} />
          <Row label="provider_scraping" value={campaign.provider_scraping || "—"} />
          <Row label="provider_enrichment" value={campaign.provider_enrichment || "—"} />
          <Row label="provider_sending" value={campaign.provider_sending || "—"} />
        </dl>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">last_provider_payload (resumen)</p>
          <pre className="mt-2 overflow-x-auto text-xs text-slate-600">
            {JSON.stringify(campaign.last_provider_payload || {}, null, 2).slice(0, 1200)}
          </pre>
        </div>

        <form onSubmit={saveExecution} className="mt-6 grid gap-4 md:grid-cols-2">
          <TextInput
            label="Provider scraping"
            value={executionForm.provider_scraping}
            onChange={(value) => setExecutionForm((s) => ({ ...s, provider_scraping: value }))}
            placeholder="outscraper"
          />
          <TextInput
            label="Provider enrichment"
            value={executionForm.provider_enrichment}
            onChange={(value) => setExecutionForm((s) => ({ ...s, provider_enrichment: value }))}
            placeholder="apollo"
          />
          <TextInput
            label="Provider sending"
            value={executionForm.provider_sending}
            onChange={(value) => setExecutionForm((s) => ({ ...s, provider_sending: value }))}
            placeholder="instantly"
          />
          <TextInput
            label="External job ID"
            value={executionForm.external_job_id}
            onChange={(value) => setExecutionForm((s) => ({ ...s, external_job_id: value }))}
            placeholder="job_123"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingExecution}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {savingExecution ? "Guardando..." : "Save Execution Setup"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Outscraper</h2>
        <p className="mt-2 text-sm text-slate-600">
          Configura scraping por campaña y sincroniza/importa resultados para actualizar métricas del dashboard.
        </p>

        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="provider_scraping_job_id" value={campaign.provider_scraping_job_id || "—"} />
          <Row label="provider_scraping_last_status" value={campaign.provider_scraping_last_status || "—"} />
          <Row label="provider_scraping_last_cost" value={money(Number(campaign.provider_scraping_last_cost || 0))} />
          <Row label="provider_scraping_last_leads" value={String(Number(campaign.provider_scraping_last_leads || 0))} />
        </dl>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">provider_scraping_last_result</p>
          <pre className="mt-2 overflow-x-auto text-xs text-slate-600">
            {JSON.stringify(campaign.provider_scraping_last_result || {}, null, 2).slice(0, 1200)}
          </pre>
        </div>

        <form onSubmit={saveOutscraperConfig} className="mt-6 grid gap-4 md:grid-cols-2">
          <TextInput
            label="Search query"
            value={outscraperForm.search_query}
            onChange={(value) => setOutscraperForm((s) => ({ ...s, search_query: value }))}
            placeholder="asesorias laborales granada"
          />
          <TextInput
            label="Country"
            value={outscraperForm.country}
            onChange={(value) => setOutscraperForm((s) => ({ ...s, country: value }))}
            placeholder="ES"
          />
          <TextInput
            label="City"
            value={outscraperForm.city}
            onChange={(value) => setOutscraperForm((s) => ({ ...s, city: value }))}
            placeholder="Granada"
          />
          <CostInput
            label="Limit"
            value={outscraperForm.limit}
            onChange={(value) => setOutscraperForm((s) => ({ ...s, limit: value }))}
            step="1"
          />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Source type</span>
            <select
              value={outscraperForm.source_type}
              onChange={(e) => setOutscraperForm((s) => ({ ...s, source_type: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="google_maps">google_maps</option>
              <option value="company_search">company_search</option>
              <option value="places_search">places_search</option>
            </select>
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingOutscraper}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {savingOutscraper ? "Guardando..." : "Save Outscraper Config"}
            </button>
            <button
              type="button"
              onClick={() => void runOutscraperAction("sync_outscraper")}
              disabled={savingOutscraper}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              Sync Outscraper
            </button>
            <button
              type="button"
              onClick={() => void importSampleOutscraper()}
              disabled={savingOutscraper}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              Import Sample Result
            </button>
            <button
              type="button"
              onClick={() => void runOutscraperAction("mark_outscraper_failed", { error_message: "manual_outscraper_failure" })}
              disabled={savingOutscraper}
              className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              Mark Outscraper Failed
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Economics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Cost per Lead" value={kpiLabel(economics.costPerLead)} />
          <MetricCard label="Cost per Demo" value={kpiLabel(economics.costPerDemo)} />
          <MetricCard label="Cost per Customer" value={kpiLabel(economics.costPerCustomer)} />
          <MetricCard label="Customers converted" value={campaign.customers_converted || 0} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Campaign identity</h2>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="Campaign name" value={`${campaign.objective} · ${campaign.location_value || campaign.location_scope}`} />
          <Row label="Objetivo" value={campaign.objective} />
          <Row label="Sector" value={campaign.sector} />
          <Row label="Ubicación" value={campaign.location_value || campaign.location_scope} />
          <Row label="Launch date" value={new Date(campaign.launched_at || campaign.created_at).toLocaleString("es-ES")} />
          <Row label="Status" value={campaign.status} />
          <Row label="Success" value={campaignSuccess(campaign)} />
          <Row label="Outcome note" value={campaign.outcome_note || "Sin nota"} />
          <Row label="Tamaño empresa" value={campaign.company_size} />
          <Row label="Canal" value={campaign.channel} />
          <Row label="Intensidad" value={campaign.intensity} />
          <Row label="Mensaje base" value={campaign.message_style} />
          <Row label="Fecha creación" value={new Date(campaign.created_at).toLocaleString("es-ES")} />
        </dl>
      </section>

      <Link href="/owner/growth" className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
        Volver a Growth
      </Link>
    </div>
  );
}

function CostInput({
  label,
  value,
  onChange,
  step = "0.01",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
      />
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
