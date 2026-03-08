"use client";

import { useState } from "react";

type CheckoutPlanKey =
  | "candidate_starter_monthly"
  | "candidate_pro_monthly"
  | "candidate_proplus_monthly"
  | "candidate_proplus_yearly";

type CandidateCard = {
  name: string;
  badge?: string;
  summary: string;
  monthly: { label: string; planKey?: CheckoutPlanKey; comingSoon?: boolean };
  yearly?: { label: string; planKey?: CheckoutPlanKey; badge?: string; comingSoon?: boolean };
};

type CompanyCard = {
  name: string;
  badge?: string;
  summary: string;
  monthly?: string;
  yearly?: string;
  cta: string;
};

export default function Precios() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(planKey: CheckoutPlanKey) {
    setLoadingPlan(planKey);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_key: planKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo iniciar el checkout.");
      }
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar el checkout.");
    } finally {
      setLoadingPlan(null);
    }
  }

  const candidatePlans: CandidateCard[] = [
    {
      name: "Free",
      summary: "Empieza tu perfil verificable con acceso base.",
      monthly: { label: "0 €" },
    },
    {
      name: "Starter",
      summary: "Perfil verificable básico con evidencias limitadas.",
      monthly: { label: "2,99 €/mes", planKey: "candidate_starter_monthly" },
      yearly: { label: "29,90 €/año", comingSoon: true },
    },
    {
      name: "Pro",
      badge: "Más popular",
      summary: "Mayor capacidad verificable y señales de credibilidad reforzadas.",
      monthly: { label: "4,99 €/mes", planKey: "candidate_pro_monthly" },
      yearly: { label: "49,90 €/año", comingSoon: true },
    },
    {
      name: "Pro+",
      summary: "Perfil profesional verificable completo con máxima capacidad.",
      monthly: { label: "9,99 €/mes", planKey: "candidate_proplus_monthly" },
      yearly: { label: "99,90 €/año", planKey: "candidate_proplus_yearly", badge: "Mejor valor" },
    },
  ];

  const companyPlans: CompanyCard[] = [
    {
      name: "Free",
      summary: "Acceso inicial para explorar el flujo de evaluación.",
      monthly: "0 €",
      cta: "Comenzar",
    },
    {
      name: "Access",
      summary: "Acceso base al perfil verificable completo.",
      monthly: "49 €/mes",
      yearly: "490 €/año",
      cta: "Solicitar Access",
    },
    {
      name: "Hiring",
      badge: "Más popular",
      summary: "Para equipos con procesos de selección continuos.",
      monthly: "99 €/mes",
      yearly: "990 €/año",
      cta: "Solicitar Hiring",
    },
    {
      name: "Team",
      summary: "Mayor capacidad operativa para equipos de reclutamiento.",
      monthly: "199 €/mes",
      yearly: "1.990 €/año",
      cta: "Solicitar Team",
    },
    {
      name: "Enterprise",
      summary: "Modelo personalizado para organizaciones con necesidades avanzadas.",
      cta: "Contactar",
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-16 text-slate-900">
      <h1 className="text-4xl font-semibold tracking-tight">Precios</h1>
      <p className="mt-4 max-w-3xl text-slate-600 leading-relaxed">
        Estructura de acceso simple: candidatos con planes progresivos y empresas con acceso al perfil verificable completo.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Candidatos</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {candidatePlans.map((plan) => {
            const featured = plan.badge === "Más popular";
            return (
              <article
                key={plan.name}
                className={`rounded-2xl border p-5 shadow-sm ${
                  featured ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-200" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {plan.badge ? (
                    <span className="rounded-full bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white">{plan.badge}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-600">{plan.summary}</p>

                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mensual</span>
                    <span className="text-sm font-semibold text-slate-900">{plan.monthly.label}</span>
                  </div>
                  {plan.yearly ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anual</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{plan.yearly.label}</span>
                        {plan.yearly.badge ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {plan.yearly.badge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                {plan.name === "Free" ? (
                  <a
                    href="/signup"
                    className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Comenzar gratis
                  </a>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => plan.monthly.planKey && startCheckout(plan.monthly.planKey)}
                      disabled={loadingPlan !== null || !plan.monthly.planKey}
                      className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      {loadingPlan === plan.monthly.planKey ? "Procesando…" : "Elegir mensual"}
                    </button>
                    {plan.yearly?.planKey ? (
                      <button
                        type="button"
                        onClick={() => startCheckout(plan.yearly!.planKey!)}
                        disabled={loadingPlan !== null}
                        className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {loadingPlan === plan.yearly.planKey ? "Procesando…" : "Elegir anual"}
                      </button>
                    ) : plan.yearly?.comingSoon ? (
                      <span className="inline-flex rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                        Anual: Próximamente
                      </span>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {error ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Empresas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-5">
          {companyPlans.map((plan) => {
            const featured = plan.badge === "Más popular";
            const valueBadge = plan.name === "Team" && plan.yearly ? "Mejor valor" : undefined;
            return (
              <article
                key={plan.name}
                className={`rounded-2xl border p-5 shadow-sm ${
                  featured ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-200" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {plan.badge ? (
                    <span className="rounded-full bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white">{plan.badge}</span>
                  ) : valueBadge ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {valueBadge}
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm text-slate-600">{plan.summary}</p>
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {plan.monthly ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mensual</span>
                      <span className="text-sm font-semibold text-slate-900">{plan.monthly}</span>
                    </div>
                  ) : null}
                  {plan.yearly ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anual</span>
                      <span className="text-sm font-semibold text-slate-900">{plan.yearly}</span>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold ${
                    plan.name === "Enterprise"
                      ? "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {plan.cta}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Pago por uso</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Perfil individual</h3>
            <p className="mt-2 text-sm text-slate-600">Desbloqueo puntual del perfil verificable de un candidato.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Pack 5 perfiles</h3>
            <p className="mt-2 text-sm text-slate-600">Paquete para procesos con varias candidaturas simultáneas.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
