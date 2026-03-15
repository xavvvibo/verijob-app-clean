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
      summary: "Crea tu perfil verificable y compártelo por link. Incluye hasta 1 verificación laboral y 1 académica activas.",
      monthly: { label: "0 €" },
    },
    {
      name: "Starter",
      summary: "Todo lo de Free, más hasta 2 verificaciones laborales y 2 académicas activas. Sin QR y sin descarga de CV verificado.",
      monthly: { label: "2,99 €/mes", planKey: "candidate_starter_monthly" },
    },
    {
      name: "Pro",
      badge: "Más popular",
      summary: "Todo lo de Starter, más comparte tu perfil también por QR. Incluye hasta 3 verificaciones laborales y 3 académicas activas.",
      monthly: { label: "4,99 €/mes", planKey: "candidate_pro_monthly" },
    },
    {
      name: "Pro+",
      summary: "Todo lo de Pro, más verificaciones activas ilimitadas y descarga de CV verificado.",
      monthly: { label: "9,99 €/mes", planKey: "candidate_proplus_monthly" },
      yearly: { label: "99,90 €/año", planKey: "candidate_proplus_yearly", badge: "Mejor valor" },
    },
  ];

  const companyPlans: CompanyCard[] = [
    {
      name: "Free",
      summary: "2 accesos a perfiles al mes y panel RRHH restringido.",
      monthly: "0 €",
      cta: "Empezar gratis",
    },
    {
      name: "Access",
      summary: "Todo lo de Free, más 15 accesos a perfiles al mes y panel RRHH operativo.",
      monthly: "49 €/mes",
      yearly: "490 €/año",
      cta: "Elegir Access",
    },
    {
      name: "Hiring",
      badge: "Más popular",
      summary: "Todo lo de Access, más 50 accesos a perfiles al mes y funcionalidades de selección.",
      monthly: "99 €/mes",
      yearly: "990 €/año",
      cta: "Elegir Hiring",
    },
    {
      name: "Team",
      summary: "Todo lo de Hiring, más 100 accesos a perfiles al mes para equipos con mayor volumen.",
      monthly: "199 €/mes",
      yearly: "1.990 €/año",
      cta: "Elegir Team",
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
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li>Compartir por link: <span className="font-semibold text-slate-900">Sí</span></li>
                  <li>
                    Compartir por QR: <span className="font-semibold text-slate-900">{plan.name === "Pro" || plan.name === "Pro+" ? "Sí" : "No"}</span>
                  </li>
                  <li>
                    Verificaciones activas:{" "}
                    <span className="font-semibold text-slate-900">
                      {plan.name === "Free"
                        ? "1 laboral + 1 académica"
                        : plan.name === "Starter"
                          ? "2 laborales + 2 académicas"
                          : plan.name === "Pro"
                            ? "3 laborales + 3 académicas"
                            : "Ilimitadas"}
                    </span>
                  </li>
                  <li>
                    Descarga CV verificado: <span className="font-semibold text-slate-900">{plan.name === "Pro+" ? "Sí" : "No"}</span>
                  </li>
                </ul>

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
                    Empezar gratis
                  </a>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => plan.monthly.planKey && startCheckout(plan.monthly.planKey)}
                      disabled={loadingPlan !== null || !plan.monthly.planKey}
                      className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      {loadingPlan === plan.monthly.planKey
                        ? "Procesando…"
                        : plan.name === "Starter"
                          ? "Elegir Starter"
                          : plan.name === "Pro"
                            ? "Mejorar a Pro"
                            : "Mejorar a Pro+"}
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
        <div className="mt-4 grid gap-4 md:grid-cols-4">
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
                  className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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
            <h3 className="text-lg font-semibold">Comprar 1 acceso</h3>
            <p className="mt-2 text-sm text-slate-600">Para acceder al perfil completo de un candidato puntual sin cambiar de plan.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Comprar pack de 5</h3>
            <p className="mt-2 text-sm text-slate-600">Paquete para procesos con varias candidaturas ya visibles en resumen parcial.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
