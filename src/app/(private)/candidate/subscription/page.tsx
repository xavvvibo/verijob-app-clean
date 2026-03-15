"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getCandidatePlanCapabilities, normalizeCandidateCommercialPlan } from "@/lib/billing/planCapabilities";

export const dynamic = "force-dynamic";

type CandidateCheckoutPlan =
  | "candidate_pro_monthly"
  | "candidate_proplus_monthly"
  | "candidate_proplus_yearly";

type CandidateTier = "free" | "starter" | "pro" | "proplus_monthly" | "proplus_yearly";

type BillingStatus = "active" | "trialing" | "trial" | "canceled" | "past_due" | "incomplete" | "unknown";

type ScheduledChange = {
  type: "downgrade";
  target_plan_key: "free" | "candidate_starter_monthly" | "candidate_pro_monthly";
  effective_at: string;
};

type SubscriptionRow = {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
  metadata: any;
  source?: "subscription" | "override" | "none";
};

type PlanOption = {
  label: string;
  planKey: CandidateCheckoutPlan;
};

const DOWNSCALE_IMPACTS = [
  "Menor capacidad de evidencias disponibles.",
  "Reducción del nivel de señales verificables visibles.",
  "Menor capacidad para reforzar credibilidad del perfil.",
  "Desactivación de funciones premium según el plan destino.",
];

function normalizeTier(planRaw: unknown): CandidateTier {
  const plan = String(planRaw || "").trim().toLowerCase();
  if (plan === "candidate_starter_monthly" || plan === "candidate_starter_yearly") return "starter";
  if (plan === "candidate_pro_monthly" || plan === "candidate_pro_yearly") return "pro";
  if (plan === "candidate_proplus_monthly") return "proplus_monthly";
  if (plan === "candidate_proplus_yearly") return "proplus_yearly";
  return "free";
}

function labelForTier(tier: CandidateTier): string {
  if (tier === "starter") return "Starter";
  if (tier === "pro") return "Pro";
  if (tier === "proplus_monthly") return "Pro+ mensual";
  if (tier === "proplus_yearly") return "Pro+ anual";
  return "Free";
}

function labelForSubscriptionStatus(statusRaw: unknown): string {
  const status = String(statusRaw || "").trim().toLowerCase() as BillingStatus;
  if (status === "active") return "Activa";
  if (status === "trial" || status === "trialing") return "En periodo de prueba";
  if (status === "canceled") return "Cancelada";
  if (status === "past_due") return "Pago pendiente";
  if (status === "incomplete") return "Pendiente de completar";
  return "Sin suscripción activa";
}

function formatDateEs(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export default function CandidateSubscriptionPage() {
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingDowngrade, setLoadingDowngrade] = useState<string | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [scheduledChange, setScheduledChange] = useState<ScheduledChange | null>(null);
  const [checkoutSyncState, setCheckoutSyncState] = useState<"idle" | "success" | "syncing">("idle");

  const currentTier = useMemo(() => normalizeTier(subscription?.plan), [subscription?.plan]);
  const planCapabilities = useMemo(() => getCandidatePlanCapabilities(subscription?.plan), [subscription?.plan]);
  const commercialTier = useMemo(() => normalizeCandidateCommercialPlan(subscription?.plan), [subscription?.plan]);
  const subscriptionStatusLabel = useMemo(
    () => labelForSubscriptionStatus(subscription?.status),
    [subscription?.status]
  );
  const renewalLabel = useMemo(() => {
    if (!subscription) return "No aplica";
    if (!subscription.current_period_end) return "No aplica";
    return formatDateEs(subscription.current_period_end);
  }, [subscription]);

  async function loadSubscriptionState(): Promise<SubscriptionRow | null> {
    setLoadingSubscription(true);
    try {
      const res = await fetch("/api/account/subscription-state", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.subscription) {
        setSubscription(null);
        setScheduledChange(null);
        return null;
      }

      const data = payload.subscription as SubscriptionRow;
      setSubscription(data);
      const raw = (data as any)?.metadata?.scheduled_change;
      if (raw && typeof raw === "object" && raw.type === "downgrade" && raw.target_plan_key && raw.effective_at) {
        setScheduledChange(raw as ScheduledChange);
      } else {
        setScheduledChange(null);
      }
      return data as SubscriptionRow;
    } finally {
      setLoadingSubscription(false);
    }
  }

  useEffect(() => {
    loadSubscriptionState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const checkoutStatus = String(searchParams.get("checkout") || "");
    if (checkoutStatus === "cancel") {
      setMessage("Checkout cancelado. Puedes intentarlo de nuevo cuando quieras.");
      return;
    }
    if (checkoutStatus !== "success") return;

    let cancelled = false;
    const maxAttempts = 6;
    const intervalMs = 2500;

    async function pollForSubscriptionSync() {
      setCheckoutSyncState("syncing");

      for (let i = 0; i < maxAttempts; i += 1) {
        if (cancelled) return;
        const fresh = await loadSubscriptionState();
        const tier = normalizeTier(fresh?.plan);
        const status = String(fresh?.status || "");
        if (tier !== "free" && (status === "active" || status === "trialing" || status === "trial")) {
          if (!cancelled) {
            setCheckoutSyncState("success");
            setMessage("Gracias, tu suscripción se ha activado correctamente.");
          }
          return;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }

      if (!cancelled) {
        setCheckoutSyncState("syncing");
        setMessage("Pago recibido. Estamos sincronizando tu suscripción.");
      }
    }

    pollForSubscriptionSync();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function startCheckout(planKey: CandidateCheckoutPlan) {
    setLoadingPlan(planKey);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_key: planKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        const raw = String(data?.error || "");
        if (raw.includes("missing_env")) {
          throw new Error("No se pudo iniciar el checkout: falta configuración de precios en Stripe.");
        }
        throw new Error(data?.error || "No se pudo iniciar el checkout.");
      }
      window.location.href = data.url;
    } catch (e: any) {
      setMessage(e?.message || "No se pudo iniciar el checkout.");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function scheduleDowngrade(targetPlanKey: "free" | "candidate_starter_monthly" | "candidate_pro_monthly") {
    setLoadingDowngrade(targetPlanKey);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_plan_key: targetPlanKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.scheduled) {
        throw new Error(data?.error || "No se pudo programar el cambio de plan.");
      }

      setMessage("Cambio programado para el próximo ciclo.");
      setScheduledChange(data.scheduled as ScheduledChange);
      await loadSubscriptionState();
    } catch (e: any) {
      setMessage(e?.message || "No se pudo programar el cambio de plan.");
    } finally {
      setLoadingDowngrade(null);
    }
  }

  async function openPortal() {
    setLoadingPortal(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No hay facturación activa para gestionar.");
      }
      window.location.href = data.url;
    } catch (e: any) {
      setMessage(e?.message || "No se pudo abrir facturación.");
    } finally {
      setLoadingPortal(false);
    }
  }

  const upgrades = useMemo<PlanOption[]>(() => {
    if (currentTier === "free" || currentTier === "starter") {
      return [
        { label: "Mejorar a Pro", planKey: "candidate_pro_monthly" },
        { label: "Pro+ mensual", planKey: "candidate_proplus_monthly" },
        { label: "Pro+ anual", planKey: "candidate_proplus_yearly" },
      ];
    }
    if (currentTier === "pro") {
      return [
        { label: "Pro+ mensual", planKey: "candidate_proplus_monthly" },
        { label: "Pro+ anual", planKey: "candidate_proplus_yearly" },
      ];
    }
    if (currentTier === "proplus_monthly") {
      return [{ label: "Pro+ anual", planKey: "candidate_proplus_yearly" }];
    }
    return [];
  }, [currentTier]);

  const downgrades = useMemo(() => {
    if (currentTier === "proplus_monthly" || currentTier === "proplus_yearly") {
      return [
        { label: "Cambiar a Pro", targetPlanKey: "candidate_pro_monthly" as const },
        { label: "Cambiar a Starter", targetPlanKey: "candidate_starter_monthly" as const },
        { label: "Cambiar a Free", targetPlanKey: "free" as const },
      ];
    }
    if (currentTier === "pro") {
      return [
        { label: "Cambiar a Starter", targetPlanKey: "candidate_starter_monthly" as const },
        { label: "Cambiar a Free", targetPlanKey: "free" as const },
      ];
    }
    if (currentTier === "starter") {
      return [{ label: "Cambiar a Free", targetPlanKey: "free" as const }];
    }
    return [];
  }, [currentTier]);

  const upgradeOptions = useMemo(
    () => upgrades.filter((u) => normalizeTier(u.planKey) !== currentTier),
    [upgrades, currentTier]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Suscripción</h1>
      <p className="text-sm text-gray-600">Gestiona tu plan, cambios de nivel y estado de facturación desde un único panel.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Resumen de facturación</h2>
          <dl className="mt-3 space-y-2 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Plan actual</dt>
              <dd className="font-medium text-gray-900">{planCapabilities.label}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Estado de suscripción</dt>
              <dd className="font-medium text-gray-900">
                {subscription ? subscriptionStatusLabel : "Sin suscripción de pago activa"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Próxima renovación</dt>
              <dd className="font-medium text-gray-900">{renewalLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Cambio programado</dt>
              <dd className="font-medium text-gray-900">
                {scheduledChange
                  ? `${scheduledChange.target_plan_key === "free" ? "Free" : labelForTier(normalizeTier(scheduledChange.target_plan_key))} (${formatDateEs(
                      scheduledChange.effective_at
                    )})`
                  : "Sin cambios programados"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Tu plan incluye</p>
            <ul className="mt-3 space-y-2">
              <li>Compartir por link: <span className="font-semibold text-slate-900">Sí</span></li>
              <li>Compartir por QR: <span className="font-semibold text-slate-900">{planCapabilities.canShareByQr ? "Sí" : "No"}</span></li>
              <li>Descarga de CV verificado: <span className="font-semibold text-slate-900">{planCapabilities.canDownloadVerifiedCv ? "Sí" : "No"}</span></li>
              <li>Verificaciones activas: <span className="font-semibold text-slate-900">{planCapabilities.activeVerificationsLabel}</span></li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">{planCapabilities.summary}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Cambiar plan</h2>
          <p className="mt-2 text-sm text-gray-600">
            Los upgrades se aplican al momento mediante checkout seguro. Los downgrades se programan para el próximo ciclo.
          </p>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Subir de plan</h3>
          {upgradeOptions.length > 0 ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {upgradeOptions.map((plan) => (
                <button
                  key={plan.planKey}
                  type="button"
                  onClick={() => startCheckout(plan.planKey)}
                  disabled={loadingPlan !== null || loadingDowngrade !== null}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {loadingPlan === plan.planKey ? "Procesando…" : plan.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-600">Ya estás en el nivel más alto disponible.</p>
          )}

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Bajar de plan</h3>
          {subscription?.source === "override" ? (
            <p className="mt-2 text-sm text-gray-600">Los cambios de plan se gestionan manualmente mientras el override owner esté activo.</p>
          ) : downgrades.length > 0 ? (
            <>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {downgrades.map((plan) => (
                  <button
                    key={plan.targetPlanKey}
                    type="button"
                    onClick={() => scheduleDowngrade(plan.targetPlanKey)}
                    disabled={loadingPlan !== null || loadingDowngrade !== null}
                    className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                  >
                    {loadingDowngrade === plan.targetPlanKey ? "Programando…" : plan.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <p className="font-semibold">Cambio programado para el próximo ciclo</p>
                <p className="mt-1">No se realiza devolución del periodo ya abonado.</p>
                <p>Las funcionalidades del nuevo plan se aplicarán en la siguiente renovación.</p>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-600">
                {DOWNSCALE_IMPACTS.map((impact) => (
                  <li key={impact}>{impact}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-600">No hay downgrades disponibles para tu plan actual.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/precios"
              className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Ver planes
            </a>
            <button
              onClick={openPortal}
              disabled={loadingPortal || subscription?.source === "override"}
              className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
            >
              {loadingPortal ? "Abriendo…" : subscription?.source === "override" ? "Plan gestionado por VERIJOB" : "Gestionar facturación"}
            </button>
          </div>
        </section>
      </div>

      {subscription?.source === "override" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tu plan está aplicado mediante override interno de VERIJOB. La facturación y los cambios automáticos no se gestionan desde Stripe en este estado.
        </div>
      ) : null}

      {!loadingSubscription && !subscription ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Estás en plan <span className="font-semibold text-slate-900">Free</span>. Mejora a Pro o Pro+ para habilitar QR, ampliar verificaciones activas y desbloquear funciones avanzadas.
        </div>
      ) : null}
      {commercialTier === "starter" ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Tu cuenta está en Starter: incluye compartir por link, hasta 2 verificaciones laborales y 2 académicas activas, sin QR y sin descarga de CV verificado.
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>
      ) : null}
      {checkoutSyncState === "syncing" && !message ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Pago recibido. Estamos sincronizando tu suscripción.
        </div>
      ) : null}
    </div>
  );
}
