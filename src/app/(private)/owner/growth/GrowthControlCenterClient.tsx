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
  closed_at?: string | null;
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

const objectiveOptions = [
  "conseguir leads nuevos",
  "reactivar empresas frías",
  "atacar nicho específico",
  "expansión geográfica",
  "follow-up de verificaciones externas",
];

const sectorOptions = [
  "hostelería",
  "asesorías laborales",
  "asesorías fiscales",
  "asesorías contables",
  "ETT",
  "hoteles",
  "restauración organizada",
  "otros",
];

const locationScopeOptions = ["Granada", "Andalucía", "España", "provincia", "ciudad"];
const companySizeOptions = ["autónomo / micro", "1-10", "11-50", "51-200", "200+"];
const channelOptions = ["email", "linkedin", "email + linkedin", "solo descubrimiento leads"];
const intensityOptions = ["baja", "media", "alta"];
const messageStyleOptions = [
  "institucional",
  "directo comercial",
  "partner / colaboración",
  "verificación / confianza laboral",
  "demo",
];

const templates = [
  {
    key: "asesorias_laborales_granada",
    label: "Asesorías laborales en Granada",
    objective: "atacar nicho específico",
    sector: "asesorías laborales",
    location_scope: "Granada",
    location_value: "Granada",
    company_size: "1-10",
    channel: "email + linkedin",
    intensity: "media",
    message_style: "partner / colaboración",
  },
  {
    key: "asesorias_fiscales_espana",
    label: "Asesorías fiscales en España",
    objective: "expansión geográfica",
    sector: "asesorías fiscales",
    location_scope: "España",
    location_value: "España",
    company_size: "11-50",
    channel: "email",
    intensity: "media",
    message_style: "institucional",
  },
  {
    key: "hosteleria_granada_centro",
    label: "Hostelería Granada centro",
    objective: "conseguir leads nuevos",
    sector: "hostelería",
    location_scope: "ciudad",
    location_value: "Granada centro",
    company_size: "1-10",
    channel: "email + linkedin",
    intensity: "alta",
    message_style: "directo comercial",
  },
  {
    key: "hoteles_andalucia",
    label: "Hoteles Andalucía",
    objective: "conseguir leads nuevos",
    sector: "hoteles",
    location_scope: "Andalucía",
    location_value: "Andalucía",
    company_size: "51-200",
    channel: "linkedin",
    intensity: "media",
    message_style: "demo",
  },
  {
    key: "externals_followup",
    label: "Empresas que verificaron externamente",
    objective: "follow-up de verificaciones externas",
    sector: "otros",
    location_scope: "España",
    location_value: "España",
    company_size: "autónomo / micro",
    channel: "email",
    intensity: "baja",
    message_style: "verificación / confianza laboral",
  },
];

function statusClass(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "running") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "paused") return "border-amber-200 bg-amber-50 text-amber-700";
  if (s === "closed") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function executionStatusClass(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "running") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "queued") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "paused") return "border-amber-200 bg-amber-50 text-amber-700";
  if (s === "completed") return "border-slate-300 bg-slate-100 text-slate-700";
  if (s === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-white text-slate-700";
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

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
      totalCost: campaign.total_cost,
      costPerLead: campaign.cost_per_lead,
      costPerDemo: campaign.cost_per_demo,
      costPerCustomer: campaign.cost_per_customer,
    };
  }

  const scraping = Number(campaign.cost_scraping || 0);
  const enrichment = Number(campaign.cost_enrichment || 0);
  const sending = Number(campaign.cost_sending || 0);
  const infra = Number(campaign.cost_infra || 0);
  const totalCost = scraping + enrichment + sending + infra;

  const leads = Number(campaign.leads_discovered || 0);
  const demos = Number(campaign.demos_count || 0);
  const customers = Number(campaign.customers_converted || 0);

  return {
    totalCost,
    costPerLead: leads > 0 ? totalCost / leads : 0,
    costPerDemo: demos > 0 ? totalCost / demos : 0,
    costPerCustomer: customers > 0 ? totalCost / customers : 0,
  };
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

export default function GrowthControlCenterClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const [form, setForm] = useState({
    objective: objectiveOptions[0],
    sector: sectorOptions[0],
    location_scope: locationScopeOptions[0],
    location_value: "Granada",
    company_size: companySizeOptions[0],
    channel: channelOptions[2],
    intensity: intensityOptions[1],
    message_style: messageStyleOptions[0],
    template_key: "",
  });

  async function loadCampaigns() {
    const res = await fetch("/api/internal/owner/growth/campaigns", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "No se pudieron cargar campañas");
    setCampaigns(Array.isArray(json?.campaigns) ? json.campaigns : []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        await loadCampaigns();
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "No se pudieron cargar campañas");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/internal/owner/growth/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, launch_now: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo crear la campaña");
      await loadCampaigns();
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la campaña");
    } finally {
      setSaving(false);
    }
  }

  async function campaignAction(id: string, action: "pause" | "resume" | "close" | "duplicate") {
    setError(null);
    try {
      const res = await fetch(`/api/internal/owner/growth/campaigns/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `No se pudo ejecutar ${action}`);
      await loadCampaigns();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la campaña");
    }
  }

  async function executionAction(
    id: string,
    action:
      | "queue_execution"
      | "start_execution"
      | "pause_execution"
      | "complete_execution"
      | "sync_now"
      | "retry_sync"
      | "refresh_metrics"
      | "mark_failed"
  ) {
    setError(null);
    try {
      const res = await fetch(`/api/internal/owner/growth/campaigns/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `No se pudo ejecutar ${action}`);
      await loadCampaigns();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar ejecución");
    }
  }

  function applyTemplate(key: string) {
    const tpl = templates.find((t) => t.key === key);
    if (!tpl) return;
    setForm({
      objective: tpl.objective,
      sector: tpl.sector,
      location_scope: tpl.location_scope,
      location_value: tpl.location_value,
      company_size: tpl.company_size,
      channel: tpl.channel,
      intensity: tpl.intensity,
      message_style: tpl.message_style,
      template_key: tpl.key,
    });
  }

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, item) => {
        const econ = calcEconomics(item);
        acc.leads += Number(item.leads_discovered || 0);
        acc.contacts += Number(item.contacts_found || 0);
        acc.messages += Number(item.messages_queued || 0);
        acc.replies += Number(item.replies_count || 0);
        acc.demos += Number(item.demos_count || 0);
        acc.cost += econ.totalCost;
        return acc;
      },
      { leads: 0, contacts: 0, messages: 0, replies: 0, demos: 0, cost: 0 }
    );
  }, [campaigns]);

  const insights = useMemo(() => {
    if (campaigns.length === 0) {
      return {
        bestCpl: null as Campaign | null,
        mostDemos: null as Campaign | null,
        highestCost: null as Campaign | null,
        bestConverting: null as Campaign | null,
      };
    }

    const withMetrics = campaigns.map((campaign) => ({
      campaign,
      econ: calcEconomics(campaign),
    }));

    const bestCpl = withMetrics
      .filter((item) => item.econ.costPerLead > 0)
      .sort((a, b) => a.econ.costPerLead - b.econ.costPerLead)[0]?.campaign || null;

    const mostDemos =
      [...campaigns].sort((a, b) => Number(b.demos_count || 0) - Number(a.demos_count || 0))[0] || null;

    const highestCost =
      withMetrics.sort((a, b) => b.econ.totalCost - a.econ.totalCost)[0]?.campaign || null;

    const bestConverting =
      [...campaigns].sort(
        (a, b) =>
          Number(b.customers_converted || 0) - Number(a.customers_converted || 0) ||
          Number(b.demos_count || 0) - Number(a.demos_count || 0)
      )[0] || null;

    return { bestCpl, mostDemos, highestCost, bestConverting };
  }, [campaigns]);

  function campaignName(campaign: Campaign) {
    return `${campaign.objective} · ${campaign.location_value || campaign.location_scope}`;
  }

  function providersSummary(campaign: Campaign) {
    const parts = [
      campaign.provider_scraping ? `S:${campaign.provider_scraping}` : null,
      campaign.provider_enrichment ? `E:${campaign.provider_enrichment}` : null,
      campaign.provider_sending ? `Send:${campaign.provider_sending}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "—";
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Growth Control Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Lanza campañas SDR + MDE y controla su rendimiento operativo y económico desde un único panel.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-slate-900">Campaign Builder</h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              void onCreateCampaign({ preventDefault() {} } as React.FormEvent);
            }}
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? "Launching..." : "Launch Campaign"}
          </button>
        </div>

        <form className="mt-4 grid gap-6 md:grid-cols-2" onSubmit={onCreateCampaign}>
          <SelectField label="Objetivo" value={form.objective} onChange={(v) => setForm((s) => ({ ...s, objective: v }))} options={objectiveOptions} />
          <SelectField label="Sector" value={form.sector} onChange={(v) => setForm((s) => ({ ...s, sector: v }))} options={sectorOptions} />
          <SelectField label="Ubicación" value={form.location_scope} onChange={(v) => setForm((s) => ({ ...s, location_scope: v }))} options={locationScopeOptions} />
          <InputField label="Valor de ubicación" value={form.location_value} onChange={(v) => setForm((s) => ({ ...s, location_value: v }))} placeholder="Granada / España / ciudad" />
          <SelectField label="Tamaño empresa" value={form.company_size} onChange={(v) => setForm((s) => ({ ...s, company_size: v }))} options={companySizeOptions} />
          <SelectField label="Canal" value={form.channel} onChange={(v) => setForm((s) => ({ ...s, channel: v }))} options={channelOptions} />
          <SelectField label="Intensidad" value={form.intensity} onChange={(v) => setForm((s) => ({ ...s, intensity: v }))} options={intensityOptions} />
          <SelectField label="Mensaje base" value={form.message_style} onChange={(v) => setForm((s) => ({ ...s, message_style: v }))} options={messageStyleOptions} />
        </form>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-2xl font-semibold text-slate-900">Quick Start Templates</h3>
        <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              onClick={() => applyTemplate(tpl.key)}
              className="rounded-lg border border-slate-200 bg-white p-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Leads discovered" value={totals.leads} />
        <MetricCard label="Contacts found" value={totals.contacts} />
        <MetricCard label="Messages sent" value={totals.messages} />
        <MetricCard label="Replies" value={totals.replies} />
        <MetricCard label="Demos booked" value={totals.demos} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-2xl font-semibold text-slate-900">Top Campaign Insights</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            title="Best CPL"
            campaign={insights.bestCpl}
            value={insights.bestCpl ? money(calcEconomics(insights.bestCpl).costPerLead) : "N/A"}
          />
          <InsightCard
            title="Most demos"
            campaign={insights.mostDemos}
            value={insights.mostDemos ? String(insights.mostDemos.demos_count || 0) : "0"}
          />
          <InsightCard
            title="Highest total cost"
            campaign={insights.highestCost}
            value={insights.highestCost ? money(calcEconomics(insights.highestCost).totalCost) : money(0)}
          />
          <InsightCard
            title="Best converting campaign"
            campaign={insights.bestConverting}
            value={insights.bestConverting ? String(insights.bestConverting.customers_converted || 0) : "0"}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-semibold text-slate-900">Campaign Economics</h3>
          <p className="text-sm text-slate-600">Coste total agregado: <span className="font-semibold text-slate-900">{money(totals.cost)}</span></p>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Cargando campañas...</p>
        ) : campaigns.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Aún no hay campañas. Lanza la primera para ver métricas de costes.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">Sector</th>
                  <th className="px-3 py-2">Launch date</th>
                  <th className="px-3 py-2">Total Cost</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2">Replies</th>
                  <th className="px-3 py-2">Demos</th>
                  <th className="px-3 py-2">CPL</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Execution status</th>
                  <th className="px-3 py-2">Sync</th>
                  <th className="px-3 py-2">Error</th>
                  <th className="px-3 py-2">Providers</th>
                  <th className="px-3 py-2">Scraping</th>
                  <th className="px-3 py-2">Last sync</th>
                  <th className="px-3 py-2">Next sync</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const econ = calcEconomics(campaign);
                  const campaignLabel = `${campaign.objective} · ${campaign.location_value || campaign.location_scope}`;
                  return (
                    <tr key={campaign.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        <Link href={`/owner/growth/campaigns/${campaign.id}`} className="hover:text-blue-700 hover:underline">
                          {campaignLabel}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{campaign.sector}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {new Date(campaign.launched_at || campaign.created_at).toLocaleDateString("es-ES")}
                      </td>
                      <td className="px-3 py-2 text-slate-900 font-medium">
                        <div>{money(econ.totalCost)}</div>
                        <div className="text-xs text-slate-500">
                          S:{money(Number(campaign.cost_scraping || 0))} · E:{money(Number(campaign.cost_enrichment || 0))} ·
                          Send:{money(Number(campaign.cost_sending || 0))} · I:{money(Number(campaign.cost_infra || 0))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{campaign.leads_discovered || 0}</td>
                      <td className="px-3 py-2 text-slate-700">{campaign.replies_count || 0}</td>
                      <td className="px-3 py-2 text-slate-700">{campaign.demos_count || 0}</td>
                      <td className="px-3 py-2 text-slate-700">{money(econ.costPerLead)}</td>
                      <td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(campaign.status)}`}>{campaign.status}</span></td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${executionStatusClass(String(campaign.execution_status || "idle"))}`}>
                          {campaign.execution_status || "idle"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{campaign.sync_attempts ?? 0} intentos</td>
                      <td className="px-3 py-2">
                        {campaign.last_provider_error ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                            Error
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{providersSummary(campaign)}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="text-xs font-medium text-slate-900">
                          {campaign.provider_scraping_last_status || "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          Coste: {money(Number(campaign.provider_scraping_last_cost || 0))}
                        </div>
                        <div className="text-xs text-slate-500">
                          Leads: {Number(campaign.provider_scraping_last_leads || 0)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {campaign.last_sync_at ? new Date(campaign.last_sync_at).toLocaleString("es-ES") : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {campaign.next_sync_at ? new Date(campaign.next_sync_at).toLocaleString("es-ES") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Link href={`/owner/growth/campaigns/${campaign.id}`} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver detalle</Link>
                          <button type="button" onClick={() => executionAction(campaign.id, "queue_execution")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Queue</button>
                          <button type="button" onClick={() => executionAction(campaign.id, "start_execution")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Start</button>
                          <button type="button" onClick={() => executionAction(campaign.id, "pause_execution")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Pause Exec</button>
                          <button type="button" onClick={() => executionAction(campaign.id, "complete_execution")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Mark Completed</button>
                          <button type="button" onClick={() => executionAction(campaign.id, "sync_now")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Sync now</button>
                          <button type="button" onClick={() => executionAction(campaign.id, "retry_sync")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Retry</button>
                          <button type="button" onClick={() => executionAction(campaign.id, "refresh_metrics")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh metrics</button>
                          <button type="button" onClick={() => executionAction(campaign.id, "mark_failed")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Mark failed</button>
                          <button type="button" onClick={() => campaignAction(campaign.id, "pause")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Pausar</button>
                          <button type="button" onClick={() => campaignAction(campaign.id, "resume")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Reanudar</button>
                          <button type="button" onClick={() => campaignAction(campaign.id, "duplicate")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Duplicar</button>
                          <button type="button" onClick={() => campaignAction(campaign.id, "close")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Cerrar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-2xl font-semibold text-slate-900">Campaign History</h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Cargando histórico...</p>
        ) : campaigns.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No hay campañas históricas todavía.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">Sector</th>
                  <th className="px-3 py-2">Launch date</th>
                  <th className="px-3 py-2">End date</th>
                  <th className="px-3 py-2">Total Cost</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2">Demos</th>
                  <th className="px-3 py-2">Customers</th>
                  <th className="px-3 py-2">CAC</th>
                  <th className="px-3 py-2">Success</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const econ = calcEconomics(campaign);
                  const success = campaignSuccess(campaign);
                  return (
                    <tr key={campaign.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        <Link href={`/owner/growth/campaigns/${campaign.id}`} className="hover:text-blue-700 hover:underline">
                          {campaignName(campaign)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{campaign.sector}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {new Date(campaign.launched_at || campaign.created_at).toLocaleDateString("es-ES")}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {campaign.closed_at ? new Date(campaign.closed_at).toLocaleDateString("es-ES") : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-900 font-medium">{money(econ.totalCost)}</td>
                      <td className="px-3 py-2 text-slate-700">{campaign.leads_discovered || 0}</td>
                      <td className="px-3 py-2 text-slate-700">{campaign.demos_count || 0}</td>
                      <td className="px-3 py-2 text-slate-700">{campaign.customers_converted || 0}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {campaign.customers_converted > 0 ? money(econ.costPerCustomer) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            success === "Positive"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : success === "Neutral"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          {success}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function InsightCard({
  title,
  campaign,
  value,
}: {
  title: string;
  campaign: Campaign | null;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      {campaign ? (
        <Link href={`/owner/growth/campaigns/${campaign.id}`} className="mt-2 block text-sm text-blue-700 hover:underline">
          {campaign.objective} · {campaign.location_value || campaign.location_scope}
        </Link>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Sin datos suficientes</p>
      )}
    </article>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder={placeholder} />
    </label>
  );
}
