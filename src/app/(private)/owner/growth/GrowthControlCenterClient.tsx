"use client";

import { useEffect, useMemo, useState } from "react";
import OwnerTooltip from "@/components/ui/OwnerTooltip";

type Campaign = {
  id: string;
  objective: string;
  sector: string;
  location_scope: string;
  location_value: string | null;
  channel: string;
  message_style: string;
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

const locationOptions = ["Granada", "Andalucía", "España", "provincia", "ciudad"];
const channelOptions = ["email", "linkedin", "email + linkedin", "solo descubrimiento leads"];
const messageStyleOptions = [
  "institucional",
  "directo comercial",
  "partner / colaboración",
  "verificación / confianza laboral",
  "demo",
];

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

export default function GrowthControlCenterClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const [form, setForm] = useState({
    objective: objectiveOptions[0],
    sector: sectorOptions[0],
    location_scope: locationOptions[0],
    channel: channelOptions[2],
    message_style: messageStyleOptions[0],
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
    setSaving(true);
    setError(null);
    try {
      const payload = {
        objective: form.objective,
        sector: form.sector,
        location_scope: form.location_scope,
        location_value: form.location_scope,
        channel: form.channel,
        message_style: form.message_style,
        // Campos legacy mantenidos para compatibilidad del backend
        company_size: "1-10",
        intensity: "media",
        template_key: null,
        launch_now: true,
      };

      const res = await fetch("/api/internal/owner/growth/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
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

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, item) => {
        acc.leads += Number(item.leads_discovered || 0);
        acc.contacts += Number(item.contacts_found || 0);
        acc.messages += Number(item.messages_queued || 0);
        acc.replies += Number(item.replies_count || 0);
        acc.demos += Number(item.demos_count || 0);
        return acc;
      },
      { leads: 0, contacts: 0, messages: 0, replies: 0, demos: 0 }
    );
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Centro de crecimiento</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gestión de campañas, métricas esenciales e histórico operativo desde un único panel.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-slate-900">Constructor de campañas</h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              void onCreateCampaign({ preventDefault() {} } as React.FormEvent);
            }}
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? "Creando..." : "Crear campaña"}
          </button>
        </div>

        <form className="mt-4 grid gap-6 md:grid-cols-2" onSubmit={onCreateCampaign}>
          <SelectField label="Objetivo" value={form.objective} onChange={(v) => setForm((s) => ({ ...s, objective: v }))} options={objectiveOptions} />
          <SelectField label="Sector" value={form.sector} onChange={(v) => setForm((s) => ({ ...s, sector: v }))} options={sectorOptions} />
          <SelectField label="Ubicación" value={form.location_scope} onChange={(v) => setForm((s) => ({ ...s, location_scope: v }))} options={locationOptions} />
          <SelectField label="Canal" value={form.channel} onChange={(v) => setForm((s) => ({ ...s, channel: v }))} options={channelOptions} />
          <SelectField label="Mensaje base" value={form.message_style} onChange={(v) => setForm((s) => ({ ...s, message_style: v }))} options={messageStyleOptions} />
        </form>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Leads descubiertos" value={totals.leads} />
        <MetricCard label="Contactos encontrados" value={totals.contacts} />
        <MetricCard label="Mensajes enviados" value={totals.messages} />
        <MetricCard label="Respuestas" value={totals.replies} />
        <MetricCard label="Demos reservadas" value={totals.demos} />
      </section>
      <p className="text-xs text-slate-500 inline-flex items-center gap-2">
        Métricas de campaña
        <OwnerTooltip text="Leads/contactos/mensajes/respuestas/demos reflejan salida operativa del flujo de growth en su estado actual." />
      </p>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-2xl font-semibold text-slate-900">Historial de campañas</h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Cargando histórico...</p>
        ) : campaigns.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Sin campañas ejecutadas todavía. Crea una campaña para activar el embudo comercial.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Sector</th>
                  <th className="px-3 py-2">Ubicación</th>
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2">Respuestas</th>
                  <th className="px-3 py-2">Demos</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{new Date(campaign.created_at).toLocaleDateString("es-ES")}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.sector}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.location_value || campaign.location_scope}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.channel}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.leads_discovered || 0}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.replies_count || 0}</td>
                    <td className="px-3 py-2 text-slate-700">{campaign.demos_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
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
