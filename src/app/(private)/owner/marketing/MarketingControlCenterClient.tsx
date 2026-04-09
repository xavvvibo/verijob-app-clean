"use client";

import { useEffect, useMemo, useState } from "react";
import OwnerModuleHeader, { OwnerProcessBadge } from "@/components/owner/OwnerModuleHeader";
import OwnerTooltip from "@/components/ui/OwnerTooltip";
import { marketingBuilderMeta, marketingFlowMeta, marketingHistoryMeta } from "@/lib/owner/owner-ui-metadata";
import {
  ownerMarketingCanActivate,
  ownerMarketingCanArchive,
  ownerMarketingCanDeleteDraft,
  ownerMarketingCanEditDraft,
  ownerMarketingCanPause,
  ownerMarketingExecutionConnected,
  ownerMarketingImpactSummary,
  ownerMarketingLifecycleHelper,
  ownerMarketingLifecycleLabel,
  ownerMarketingProcessState,
  OwnerMarketingSurface,
  ownerMarketingSurfaceLabel,
  readOwnerMarketingMetadata,
  resolveOwnerMarketingLifecycle,
} from "@/lib/owner/marketing-promotions";

type PromoCode = {
  id: string;
  code: string;
  target_type: string;
  benefit_type: string;
  benefit_value: string | null;
  starts_at: string | null;
  expires_at: string | null;
  duration_days: number | null;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
  campaign_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type PromoFormState = {
  target_type: string;
  benefit_type: string;
  duration_option: string;
  max_redemptions: string;
  application_surface: string;
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
const surfaceOptions = [
  { value: "not_connected", label: "Destino aún no conectado" },
  { value: "signup", label: "Signup" },
  { value: "upgrade", label: "Upgrade" },
  { value: "billing", label: "Billing" },
  { value: "owner_manual_assignment", label: "Asignación manual owner" },
  { value: "other", label: "Otra" },
];

const initialPromoForm: PromoFormState = {
  target_type: targetOptions[0],
  benefit_type: benefitOptions[0],
  duration_option: durationOptions[0],
  max_redemptions: "5",
  application_surface: surfaceOptions[0].value,
};

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
    </article>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No definida";
  return new Date(value).toLocaleDateString("es-ES");
}

function formFromPromo(promo: PromoCode): PromoFormState {
  const metadata = readOwnerMarketingMetadata(promo.metadata);
  return {
    target_type: promo.target_type || targetOptions[0],
    benefit_type: promo.benefit_type || benefitOptions[0],
    duration_option: durationOptionFromPromo(promo),
    max_redemptions: promo.max_redemptions === null ? "ilimitado" : String(promo.max_redemptions || 1),
    application_surface: metadata.application_surface || "not_connected",
  };
}

function durationOptionFromPromo(promo: PromoCode): string {
  const days = Number(promo.duration_days || 0);
  if (!days || !Number.isFinite(days)) return "sin_caducidad";
  const option = `${days}_dias`;
  return durationOptions.includes(option) ? option : "sin_caducidad";
}

function getPromoSurfaceValue(promo: PromoCode): OwnerMarketingSurface {
  const metadata = readOwnerMarketingMetadata(promo.metadata);
  const value = metadata.application_surface;
  return surfaceOptions.some((option) => option.value === value) ? (value as OwnerMarketingSurface) : "not_connected";
}

export default function MarketingControlCenterClient() {
  const [loading, setLoading] = useState(true);
  const [savingPromo, setSavingPromo] = useState(false);
  const [savingActionId, setSavingActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);

  const [promoForm, setPromoForm] = useState<PromoFormState>(initialPromoForm);
  const [editForm, setEditForm] = useState<PromoFormState>(initialPromoForm);

  async function loadData(nextSelectedId?: string | null) {
    const promoRes = await fetch("/api/internal/owner/marketing/promo-codes", { cache: "no-store" });
    const promoJson = await promoRes.json().catch(() => ({}));
    if (!promoRes.ok) throw new Error(promoJson?.error || "No se pudieron cargar promociones");
    const rows = Array.isArray(promoJson?.promo_codes) ? promoJson.promo_codes : [];
    setPromoCodes(rows);
    const selected = nextSelectedId === undefined ? selectedPromoId : nextSelectedId;
    if (selected && rows.some((promo: PromoCode) => promo.id === selected)) {
      setSelectedPromoId(selected);
      return;
    }
    setSelectedPromoId(rows[0]?.id || null);
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

  const selectedPromo = useMemo(
    () => promoCodes.find((promo) => promo.id === selectedPromoId) || null,
    [promoCodes, selectedPromoId],
  );

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
          application_surface: promoForm.application_surface,
          benefit_value: null,
          code_mode: "autogen",
          custom_code: null,
          campaign_type: "marketing_simple",
          custom_expires_at: null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo crear la promoción");
      const createdId = String(json?.promo_code?.id || "");
      setPromoForm(initialPromoForm);
      setEditingPromoId(null);
      await loadData(createdId || null);
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la promoción");
    } finally {
      setSavingPromo(false);
    }
  }

  async function runPromoAction(id: string, action: string, extra?: Record<string, unknown>) {
    setSavingActionId(id);
    setError(null);
    try {
      const res = await fetch(`/api/internal/owner/marketing/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...(extra || {}) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo actualizar la promoción");
      setEditingPromoId(null);
      await loadData(id);
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la promoción");
    } finally {
      setSavingActionId(null);
    }
  }

  async function deletePromo(id: string) {
    setSavingActionId(id);
    setError(null);
    try {
      const res = await fetch(`/api/internal/owner/marketing/promo-codes/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo eliminar la promoción");
      setEditingPromoId(null);
      await loadData(null);
    } catch (e: any) {
      setError(e?.message || "No se pudo eliminar la promoción");
    } finally {
      setSavingActionId(null);
    }
  }

  async function saveDraftChanges(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPromo) return;
    const maxRedemptions = editForm.max_redemptions === "ilimitado" ? null : Number(editForm.max_redemptions);
    await runPromoAction(selectedPromo.id, "update", {
      target_type: editForm.target_type,
      benefit_type: editForm.benefit_type,
      duration_option: editForm.duration_option,
      max_redemptions: maxRedemptions,
      application_surface: editForm.application_surface,
      benefit_value: null,
      custom_expires_at: null,
    });
  }

  function startEditing(promo: PromoCode) {
    setSelectedPromoId(promo.id);
    setEditingPromoId(promo.id);
    setEditForm(formFromPromo(promo));
  }

  const analytics = useMemo(() => {
    const drafts = promoCodes.filter((promo) => resolveOwnerMarketingLifecycle(promo) === "draft").length;
    const pendingActivation = promoCodes.filter((promo) => resolveOwnerMarketingLifecycle(promo) === "configured").length;
    const connected = promoCodes.filter((promo) => ownerMarketingExecutionConnected(readOwnerMarketingMetadata(promo.metadata))).length;
    const redemptions = promoCodes.reduce((acc, promo) => acc + Number(promo.current_redemptions || 0), 0);
    return { drafts, pendingActivation, connected, redemptions };
  }, [promoCodes]);

  const builderMeta = marketingBuilderMeta(savingPromo);
  const flowMeta = marketingFlowMeta(analytics.pendingActivation > 0 || analytics.connected > 0);
  const historyMeta = marketingHistoryMeta(promoCodes.length > 0);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Centro de marketing</h1>
        <p className="mt-2 text-sm text-slate-600">
          Registro owner de promociones y beneficios. Solo impacta producto o billing cuando una promoción tenga una superficie realmente conectada.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-4">
        <MetricCard label="Borradores" value={analytics.drafts} helper="Promociones aún editables." />
        <MetricCard label="Pendientes de activación real" value={analytics.pendingActivation} helper="Registradas por owner, sin automatización." />
        <MetricCard label="Con destino conectado" value={analytics.connected} helper="Las únicas que podrían impactar producto o billing." />
        <MetricCard label="Usos registrados" value={analytics.redemptions} helper="Leídos desde el contador actual de la promoción." />
      </section>
      <p className="inline-flex items-center gap-2 text-xs text-slate-500">
        Diagnóstico del módulo
        <OwnerTooltip text="El módulo distingue entre promoción registrada y promoción realmente conectada. Si el destino no está conectado, la promoción no se considera activa real." />
      </p>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <OwnerModuleHeader
          title={builderMeta.title}
          helperText={builderMeta.helperText}
          processState={builderMeta.processState}
          nextStep={builderMeta.nextStep}
          stateLabel={builderMeta.stateLabel}
        />
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Crear promoción genera un registro interno en <code>promo_codes</code>. No conecta checkout, signup ni billing automáticamente.
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{flowMeta.title}</p>
              <p className="mt-1 text-sm text-slate-600">{flowMeta.helperText}</p>
              <p className="mt-1 text-xs text-slate-500">Siguiente paso: definir el destino previsto y decidir si la promoción es solo registro interno o si requiere conexión real.</p>
            </div>
            <OwnerProcessBadge processState={savingPromo ? "working" : "draft"} label={savingPromo ? "Guardando" : "Borrador al crear"} />
          </div>
        </div>
        <form className="mt-4 grid gap-6 md:grid-cols-2" onSubmit={createPromo}>
          <SelectField label="Target" value={promoForm.target_type} onChange={(v) => setPromoForm((s) => ({ ...s, target_type: v }))} options={targetOptions} />
          <SelectField label="Beneficio" value={promoForm.benefit_type} onChange={(v) => setPromoForm((s) => ({ ...s, benefit_type: v }))} options={benefitOptions} />
          <SelectField label="Duración" value={promoForm.duration_option} onChange={(v) => setPromoForm((s) => ({ ...s, duration_option: v }))} options={durationOptions} />
          <SelectField label="Límite de uso" value={promoForm.max_redemptions} onChange={(v) => setPromoForm((s) => ({ ...s, max_redemptions: v }))} options={["1", "5", "10", "25", "ilimitado"]} />
          <SelectField
            label="Destino previsto"
            value={promoForm.application_surface}
            onChange={(v) => setPromoForm((s) => ({ ...s, application_surface: v }))}
            options={surfaceOptions.map((option) => option.value)}
            optionLabels={Object.fromEntries(surfaceOptions.map((option) => [option.value, option.label]))}
          />

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
            No hay promociones registradas. La primera promoción se guardará como borrador interno.
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Destino</th>
                    <th className="px-3 py-2">Beneficio</th>
                    <th className="px-3 py-2">Usos</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((promo) => {
                    const lifecycle = resolveOwnerMarketingLifecycle(promo);
                    const label = ownerMarketingLifecycleLabel(lifecycle, promo);
                    const processState = ownerMarketingProcessState(promo);
                    const impactSummary = ownerMarketingImpactSummary(promo);
                    const surfaceLabel = ownerMarketingSurfaceLabel(getPromoSurfaceValue(promo));
                    const isSelected = selectedPromoId === promo.id;
                    const isBusy = savingActionId === promo.id;
                    return (
                      <tr key={promo.id} className={`border-b border-slate-100 align-top ${isSelected ? "bg-slate-50/60" : ""}`}>
                        <td className="px-3 py-2 text-slate-700">{formatDate(promo.created_at)}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{promo.code}</div>
                          <div className="mt-1 text-xs text-slate-500">{impactSummary}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{promo.target_type}</td>
                        <td className="px-3 py-2 text-slate-700">{surfaceLabel}</td>
                        <td className="px-3 py-2">
                          <div className="text-slate-700">{promo.benefit_type}</div>
                          <div className="mt-1 text-xs text-slate-500">Fin: {formatDate(promo.expires_at)}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{promo.current_redemptions}</td>
                        <td className="px-3 py-2">
                          <OwnerProcessBadge processState={processState} label={label} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPromoId(promo.id);
                                setEditingPromoId(null);
                              }}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Ver detalle
                            </button>
                            {ownerMarketingCanEditDraft(promo) ? (
                              <button
                                type="button"
                                onClick={() => startEditing(promo)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Editar
                              </button>
                            ) : null}
                            {ownerMarketingCanActivate(promo) ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => runPromoAction(promo.id, "activate")}
                                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                              >
                                {lifecycle === "paused" ? "Reanudar" : "Activar"}
                              </button>
                            ) : null}
                            {ownerMarketingCanPause(promo) ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => runPromoAction(promo.id, "pause")}
                                className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                              >
                                Pausar
                              </button>
                            ) : null}
                            {ownerMarketingCanArchive(promo) ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => runPromoAction(promo.id, "archive")}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                Archivar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedPromo ? (
              <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">Detalle de promoción</h3>
                      <OwnerProcessBadge
                        processState={ownerMarketingProcessState(selectedPromo)}
                        label={ownerMarketingLifecycleLabel(resolveOwnerMarketingLifecycle(selectedPromo), selectedPromo)}
                      />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{ownerMarketingLifecycleHelper(selectedPromo)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ownerMarketingCanEditDraft(selectedPromo) ? (
                      <button
                        type="button"
                        onClick={() => startEditing(selectedPromo)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Editar borrador
                      </button>
                    ) : null}
                    {ownerMarketingCanActivate(selectedPromo) ? (
                      <button
                        type="button"
                        disabled={savingActionId === selectedPromo.id}
                        onClick={() => runPromoAction(selectedPromo.id, "activate")}
                        className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                      >
                        {resolveOwnerMarketingLifecycle(selectedPromo) === "paused" ? "Reanudar" : "Activar"}
                      </button>
                    ) : null}
                    {ownerMarketingCanPause(selectedPromo) ? (
                      <button
                        type="button"
                        disabled={savingActionId === selectedPromo.id}
                        onClick={() => runPromoAction(selectedPromo.id, "pause")}
                        className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                      >
                        Pausar
                      </button>
                    ) : null}
                    {ownerMarketingCanArchive(selectedPromo) ? (
                      <button
                        type="button"
                        disabled={savingActionId === selectedPromo.id}
                        onClick={() => runPromoAction(selectedPromo.id, "archive")}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        Archivar
                      </button>
                    ) : null}
                    {ownerMarketingCanDeleteDraft(selectedPromo) ? (
                      <button
                        type="button"
                        disabled={savingActionId === selectedPromo.id}
                        onClick={() => deletePromo(selectedPromo.id)}
                        className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Eliminar borrador
                      </button>
                    ) : null}
                  </div>
                </div>

                {editingPromoId === selectedPromo.id ? (
                  <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={saveDraftChanges}>
                    <SelectField label="Target" value={editForm.target_type} onChange={(v) => setEditForm((s) => ({ ...s, target_type: v }))} options={targetOptions} />
                    <SelectField label="Beneficio" value={editForm.benefit_type} onChange={(v) => setEditForm((s) => ({ ...s, benefit_type: v }))} options={benefitOptions} />
                    <SelectField label="Duración" value={editForm.duration_option} onChange={(v) => setEditForm((s) => ({ ...s, duration_option: v }))} options={durationOptions} />
                    <SelectField label="Límite de uso" value={editForm.max_redemptions} onChange={(v) => setEditForm((s) => ({ ...s, max_redemptions: v }))} options={["1", "5", "10", "25", "ilimitado"]} />
                    <SelectField
                      label="Destino previsto"
                      value={editForm.application_surface}
                      onChange={(v) => setEditForm((s) => ({ ...s, application_surface: v }))}
                      options={surfaceOptions.map((option) => option.value)}
                      optionLabels={Object.fromEntries(surfaceOptions.map((option) => [option.value, option.label]))}
                    />
                    <div className="md:col-span-2 flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={savingActionId === selectedPromo.id}
                        className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                      >
                        Guardar borrador
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPromoId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <DetailItem label="Código" value={selectedPromo.code} />
                    <DetailItem label="Target" value={selectedPromo.target_type} />
                    <DetailItem label="Destino" value={ownerMarketingSurfaceLabel(getPromoSurfaceValue(selectedPromo))} />
                    <DetailItem label="Impacto real" value={ownerMarketingImpactSummary(selectedPromo)} />
                    <DetailItem label="Beneficio" value={selectedPromo.benefit_type} />
                    <DetailItem label="Duración" value={selectedPromo.expires_at ? `Hasta ${formatDate(selectedPromo.expires_at)}` : "Sin fecha fin"} />
                    <DetailItem label="Fecha inicio" value={formatDate(selectedPromo.starts_at)} />
                    <DetailItem label="Fecha fin" value={formatDate(selectedPromo.expires_at)} />
                    <DetailItem label="Límite de uso" value={selectedPromo.max_redemptions ?? "Ilimitado"} />
                    <DetailItem label="Usos" value={selectedPromo.current_redemptions} />
                    <DetailItem
                      label="Automatización"
                      value={
                        ownerMarketingExecutionConnected(readOwnerMarketingMetadata(selectedPromo.metadata))
                          ? "Conectada"
                          : "Promoción registrada sin automatización activa"
                      }
                    />
                    <DetailItem label="Canal actual" value={selectedPromo.campaign_type || "Registro interno"} />
                  </div>
                )}
              </section>
            ) : null}
          </>
        )}
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>
      ) : null}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-sm text-slate-900">{value}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  optionLabels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
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
          <option key={option} value={option}>
            {optionLabels?.[option] || option}
          </option>
        ))}
      </select>
    </label>
  );
}
