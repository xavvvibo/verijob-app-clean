"use client";

import { useEffect, useMemo, useState } from "react";
import OwnerModuleHeader, { OwnerProcessBadge } from "@/components/owner/OwnerModuleHeader";
import OwnerTooltip from "@/components/ui/OwnerTooltip";
import { marketingBuilderMeta, marketingFlowMeta, marketingHistoryMeta, resolvePromoMeta } from "@/lib/owner/owner-ui-metadata";

type PromoCode = {
  id: string;
  code: string;
  target_type: string;
  benefit_type: string;
  benefit_value: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
  created_at: string;
};

const targetOptions = ["candidatos", "empresas", "ambos"];
const benefitOptions = [
  "upgrade a Pro",
  "upgrade a Pro+",
  "descuento 25%",
  "descuento 50%",
  "100% gratis temporal",
  "plan especial",
];
const durationOptions = ["7_dias", "14_dias", "30_dias", "90_dias", "sin_caducidad"];

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

export default function MarketingControlCenterClient() {
  const [loading, setLoading] = useState(true);
  const [savingPromo, setSavingPromo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);

  const [promoForm, setPromoForm] = useState({
    target_type: targetOptions[0],
    benefit_type: benefitOptions[0],
    duration_option: durationOptions[0],
    max_redemptions: "5",
  });

  async function loadData() {
    const promoRes = await fetch("/api/internal/owner/marketing/promo-codes", { cache: "no-store" });
    const promoJson = await promoRes.json().catch(() => ({}));
    if (!promoRes.ok) throw new Error(promoJson?.error || "No se pudieron cargar promociones");
    setPromoCodes(Array.isArray(promoJson?.promo_codes) ? promoJson.promo_codes : []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        await loadData();
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "No se pudo cargar el módulo de marketing");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    setSavingPromo(true);
    setError(null);
    try {
      const maxRedemptions = promoForm.max_redemptions === "ilimitado" ? null : Number(promoForm.max_redemptions);
      const res = await fetch("/api/internal/owner/marketing/promo-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target_type: promoForm.target_type,
          benefit_type: promoForm.benefit_type,
          duration_option: promoForm.duration_option,
          max_redemptions: maxRedemptions,
          // Compatibilidad backend
          benefit_value: null,
          code_mode: "autogen",
          custom_code: null,
          campaign_type: "marketing_simple",
          custom_expires_at: null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo crear la promoción");
      await loadData();
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la promoción");
    } finally {
      setSavingPromo(false);
    }
  }

  const analytics = useMemo(() => {
    const redemptions = promoCodes.reduce((acc, p) => acc + Number(p.current_redemptions || 0), 0);
    const activePromos = promoCodes.filter((p) => p.is_active).length;
    const nextExpiry = promoCodes
      .map((promo) => promo.expires_at)
      .filter(Boolean)
      .sort((a, b) => new Date(String(a)).getTime() - new Date(String(b)).getTime())[0];
    return { redemptions, activePromos, nextExpiry };
  }, [promoCodes]);

  const builderMeta = marketingBuilderMeta(savingPromo);
  const flowMeta = marketingFlowMeta();
  const historyMeta = marketingHistoryMeta(promoCodes.length > 0);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Centro de marketing</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gestión de promociones activas y control de activación comercial en tiempo real.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <MetricCard label="Promociones activas" value={analytics.activePromos} />
        <MetricCard label="Usos totales" value={analytics.redemptions} />
        <MetricCard
          label="Próxima caducidad"
          value={analytics.nextExpiry ? new Date(String(analytics.nextExpiry)).toLocaleDateString("es-ES") : "Sin caducidad"}
        />
      </section>
      <p className="text-xs text-slate-500 inline-flex items-center gap-2">
        Indicadores de marketing
        <OwnerTooltip text="Estos indicadores muestran activación de promociones y uso real por parte de usuarios objetivo." />
      </p>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <OwnerModuleHeader
          title={builderMeta.title}
          helperText={builderMeta.helperText}
          processState={builderMeta.processState}
          nextStep={builderMeta.nextStep}
          stateLabel={builderMeta.stateLabel}
        />
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{flowMeta.title}</p>
              <p className="mt-1 text-sm text-slate-600">{flowMeta.helperText}</p>
              <p className="mt-1 text-xs text-slate-500">Siguiente paso: activar el incentivo para {promoForm.target_type} y validar la difusión.</p>
            </div>
            <OwnerProcessBadge processState={savingPromo ? "working" : "active"} label={savingPromo ? "Trabajando" : "Activa al crear"} />
          </div>
        </div>
        <form className="mt-4 grid gap-6 md:grid-cols-2" onSubmit={createPromo}>
          <SelectField label="Objetivo" value={promoForm.target_type} onChange={(v) => setPromoForm((s) => ({ ...s, target_type: v }))} options={targetOptions} />
          <SelectField label="Beneficio" value={promoForm.benefit_type} onChange={(v) => setPromoForm((s) => ({ ...s, benefit_type: v }))} options={benefitOptions} />
          <SelectField label="Duración" value={promoForm.duration_option} onChange={(v) => setPromoForm((s) => ({ ...s, duration_option: v }))} options={durationOptions} />
          <SelectField label="Límite de uso" value={promoForm.max_redemptions} onChange={(v) => setPromoForm((s) => ({ ...s, max_redemptions: v }))} options={["1", "5", "10", "25", "ilimitado"]} />

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingPromo}
              className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {savingPromo ? "Creando..." : "Crear promoción"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <OwnerModuleHeader
          title={historyMeta.title}
          helperText={historyMeta.helperText}
          processState={historyMeta.processState}
          nextStep={historyMeta.nextStep}
        />
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Cargando promociones...</p>
        ) : promoCodes.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Sin promociones activas por ahora. Crea una promoción para activar captación o reactivación.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Objetivo</th>
                  <th className="px-3 py-2">Beneficio</th>
                  <th className="px-3 py-2">Duración</th>
                  <th className="px-3 py-2">Límite</th>
                  <th className="px-3 py-2">Usos</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((promo) => {
                  const promoMeta = resolvePromoMeta(promo);
                  return (
                    <tr key={promo.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2 text-slate-700">{new Date(promo.created_at).toLocaleDateString("es-ES")}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{promo.target_type}</div>
                        <div className="mt-1 max-w-md text-xs text-slate-500">{promoMeta.helperText}</div>
                        {promoMeta.nextStep ? <div className="mt-1 text-[11px] text-slate-400">Siguiente paso: {promoMeta.nextStep}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{promo.benefit_type}</td>
                      <td className="px-3 py-2 text-slate-700">{promo.expires_at ? new Date(promo.expires_at).toLocaleDateString("es-ES") : "Sin caducidad"}</td>
                      <td className="px-3 py-2 text-slate-700">{promo.max_redemptions ?? "∞"}</td>
                      <td className="px-3 py-2 text-slate-700">{promo.current_redemptions}</td>
                      <td className="px-3 py-2">
                        <OwnerProcessBadge processState={promoMeta.processState} label={promoMeta.stateLabel} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>
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
  onChange: (v: string) => void;
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
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
