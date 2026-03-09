"use client";

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
  leads_discovered: number;
  contacts_found: number;
  messages_queued: number;
  replies_count: number;
  demos_count: number;
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

export default function GrowthControlCenterClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      setSelectedId(json?.campaign?.id || null);
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
      if (json?.campaign?.id) setSelectedId(json.campaign.id);
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la campaña");
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

  const selectedCampaign = useMemo(() => campaigns.find((c) => c.id === selectedId) || null, [campaigns, selectedId]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Growth Control Center</h1>
        <p className="mt-2 text-sm text-slate-600">Lanza campañas SDR + MDE con pocos pasos y deja la operación preparada para orquestación posterior.</p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Quick Start Templates</h2>
          <span className="text-xs text-slate-500">Rellenado automático</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              onClick={() => applyTemplate(tpl.key)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Campaign Builder</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onCreateCampaign}>
          <SelectField label="Objetivo" value={form.objective} onChange={(v) => setForm((s) => ({ ...s, objective: v }))} options={objectiveOptions} />
          <SelectField label="Sector" value={form.sector} onChange={(v) => setForm((s) => ({ ...s, sector: v }))} options={sectorOptions} />
          <SelectField label="Ubicación (scope)" value={form.location_scope} onChange={(v) => setForm((s) => ({ ...s, location_scope: v }))} options={locationScopeOptions} />
          <InputField label="Ubicación (valor)" value={form.location_value} onChange={(v) => setForm((s) => ({ ...s, location_value: v }))} placeholder="Granada / España / ciudad concreta" />
          <SelectField label="Tamaño empresa" value={form.company_size} onChange={(v) => setForm((s) => ({ ...s, company_size: v }))} options={companySizeOptions} />
          <SelectField label="Canal" value={form.channel} onChange={(v) => setForm((s) => ({ ...s, channel: v }))} options={channelOptions} />
          <SelectField label="Intensidad" value={form.intensity} onChange={(v) => setForm((s) => ({ ...s, intensity: v }))} options={intensityOptions} />
          <SelectField label="Mensaje base" value={form.message_style} onChange={(v) => setForm((s) => ({ ...s, message_style: v }))} options={messageStyleOptions} />

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Creando..." : "Comenzar"}
            </button>
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Campaigns Running</h2>
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Cargando campañas...</p>
        ) : campaigns.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Aquí verás campañas de growth SDR + MDE en cuanto lances la primera.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Campaña</th>
                  <th className="px-3 py-2">Objetivo</th>
                  <th className="px-3 py-2">Sector</th>
                  <th className="px-3 py-2">Ubicación</th>
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2">Contactos</th>
                  <th className="px-3 py-2">Mensajes</th>
                  <th className="px-3 py-2">Respuestas</th>
                  <th className="px-3 py-2">Demos</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{campaign.template_key || campaign.id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.objective}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.sector}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.location_value || campaign.location_scope}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.channel}</td>
                    <td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(campaign.status)}`}>{campaign.status}</span></td>
                    <td className="px-3 py-2 text-slate-700">{campaign.leads_discovered || 0}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.contacts_found || 0}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.messages_queued || 0}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.replies_count || 0}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.demos_count || 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => setSelectedId(campaign.id)} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">ver detalle</button>
                        <button type="button" onClick={() => campaignAction(campaign.id, "pause")} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">pausar</button>
                        <button type="button" onClick={() => campaignAction(campaign.id, "resume")} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">reanudar</button>
                        <button type="button" onClick={() => campaignAction(campaign.id, "duplicate")} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">duplicar</button>
                        <button type="button" onClick={() => campaignAction(campaign.id, "close")} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">cerrar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCampaign ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Detalle campaña</h3>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p><span className="font-semibold">Objetivo:</span> {selectedCampaign.objective}</p>
            <p><span className="font-semibold">Sector:</span> {selectedCampaign.sector}</p>
            <p><span className="font-semibold">Ubicación:</span> {selectedCampaign.location_value || selectedCampaign.location_scope}</p>
            <p><span className="font-semibold">Canal:</span> {selectedCampaign.channel}</p>
            <p><span className="font-semibold">Intensidad:</span> {selectedCampaign.intensity}</p>
            <p><span className="font-semibold">Mensaje base:</span> {selectedCampaign.message_style}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function InputField({
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
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}
