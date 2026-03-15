"use client";

import { useState } from "react";

type PlanCard = {
  label: string;
  planKey: string;
  price: string;
  summary: string;
  bullets: string[];
  featured?: boolean;
};

const PLANS: PlanCard[] = [
  {
    label: "Access",
    planKey: "company_access_monthly",
    price: "49 €/mes",
    summary: "Para empezar a operar con solicitudes y candidatos verificables.",
    bullets: ["2 plazas de equipo", "Base operativa", "Acceso inicial a candidatos"],
  },
  {
    label: "Hiring",
    planKey: "company_hiring_monthly",
    price: "99 €/mes",
    summary: "Para equipos con más volumen de revisión y selección.",
    bullets: ["5 plazas de equipo", "Más ritmo operativo", "Mejor throughput de revisión"],
    featured: true,
  },
  {
    label: "Team",
    planKey: "company_team_monthly",
    price: "199 €/mes",
    summary: "Para operaciones de RRHH ligero con varios usuarios y más capacidad.",
    bullets: ["10 plazas de equipo", "Coordinación ampliada", "Escalado de operación"],
  },
];

const VIEW_PACKS = [
  {
    label: "1 acceso",
    planKey: "company_single_cv",
    summary: "Para acceder a un perfil completo puntual sin cambiar de plan.",
  },
  {
    label: "Pack de 5 accesos",
    planKey: "company_pack_5",
    summary: "Para procesos activos con varios candidatos ya en resumen parcial.",
  },
];

export default function CompanyPlanActions({
  currentPlanLabel,
  currentPlanCode,
  hasActiveSubscription,
}: {
  currentPlanLabel: string;
  currentPlanCode: string;
  hasActiveSubscription: boolean;
}) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startCheckout(planKey: string) {
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
          throw new Error("Falta configuración de precios en Stripe para este plan.");
        }
        if (raw === "enterprise_contact_only") {
          throw new Error("El plan Enterprise se activa con contacto comercial.");
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

  async function openPortal() {
    setLoadingPortal(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No hay una suscripción activa para gestionar.");
      }
      window.location.href = data.url;
    } catch (e: any) {
      setMessage(e?.message || "No se pudo abrir facturación.");
    } finally {
      setLoadingPortal(false);
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {hasActiveSubscription ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={loadingPortal}
            className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {loadingPortal ? "Abriendo facturación…" : "Gestionar pago y facturas"}
          </button>
        ) : null}
        <a
          href="mailto:contacto@verijob.es?subject=Plan%20empresa%20VERIJOB"
          className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Contactar con ventas
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlanCode.includes(plan.label.toLowerCase()) || currentPlanLabel === plan.label;
          return (
            <article
              key={plan.planKey}
              className={`rounded-3xl border p-6 shadow-sm ${
                plan.featured ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{plan.label}</h3>
                {isCurrent ? (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${plan.featured ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>
                    Plan actual
                  </span>
                ) : null}
              </div>
              <p className={`mt-2 text-3xl font-semibold ${plan.featured ? "text-white" : "text-slate-900"}`}>{plan.price}</p>
              <p className={`mt-2 text-sm ${plan.featured ? "text-white/80" : "text-slate-600"}`}>{plan.summary}</p>
              <ul className={`mt-4 space-y-2 text-sm ${plan.featured ? "text-white/90" : "text-slate-600"}`}>
                {plan.bullets.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={isCurrent || loadingPlan === plan.planKey}
                  onClick={() => startCheckout(plan.planKey)}
                  className={`inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    plan.featured
                      ? "bg-white text-slate-900 hover:bg-slate-100"
                      : "bg-slate-900 text-white hover:bg-black"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {loadingPlan === plan.planKey ? "Abriendo checkout…" : isCurrent ? "Plan actual" : "Mejorar a este plan"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-base font-semibold text-slate-900">Accesos puntuales a perfiles</h3>
        <p className="mt-2 text-sm text-slate-600">
          Si no necesitas cambiar de plan, puedes comprar accesos puntuales para abrir perfiles completos desde los resúmenes parciales.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {VIEW_PACKS.map((pack) => (
            <article key={pack.planKey} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-900">{pack.label}</h4>
              <p className="mt-2 text-sm text-slate-600">{pack.summary}</p>
              <button
                type="button"
                disabled={loadingPlan === pack.planKey}
              onClick={() => startCheckout(pack.planKey)}
              className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
                {loadingPlan === pack.planKey ? "Abriendo checkout…" : `Comprar ${pack.label.toLowerCase()}`}
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
