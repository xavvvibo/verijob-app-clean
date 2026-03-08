"use client";

import { useState } from "react";

type CandidatePlan = {
  name: string;
  monthlyPrice: string;
  yearlyPrice?: string;
  summary: string;
  features: string[];
  monthlyPlanKey?: "candidate_starter_monthly" | "candidate_pro_monthly" | "candidate_proplus_monthly";
  yearlyPlanKey?: "candidate_proplus_yearly";
  cta?: string;
};

type CheckoutPlanKey =
  | "candidate_starter_monthly"
  | "candidate_pro_monthly"
  | "candidate_proplus_monthly"
  | "candidate_proplus_yearly";

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

  const candidatePlans: CandidatePlan[] = [
    {
      name: "Free",
      monthlyPrice: "0€",
      summary: "Empieza tu perfil verificable con acceso base.",
      features: ["Perfil verificable básico", "Señales iniciales de credibilidad", "Acceso sin coste"],
      cta: "Comenzar gratis",
    },
    {
      name: "Starter",
      monthlyPrice: "2,99 €/mes",
      summary: "Perfil verificable básico para empezar a validar experiencia.",
      features: ["Perfil verificable básico", "Evidencias limitadas", "Primer nivel de visibilidad profesional"],
      monthlyPlanKey: "candidate_starter_monthly",
      cta: "Activar Starter",
    },
    {
      name: "Pro",
      monthlyPrice: "4,99 €/mes",
      summary: "Perfil más sólido con mayor capacidad de credibilidad.",
      features: ["Más evidencias verificables", "Señales de confianza reforzadas", "Mejor presentación ante empresas"],
      monthlyPlanKey: "candidate_pro_monthly",
      cta: "Activar Pro",
    },
    {
      name: "Pro+",
      monthlyPrice: "9,99 €/mes",
      yearlyPrice: "99,90 €/año",
      summary: "Perfil profesional verificable completo con máxima capacidad.",
      features: ["Trayectoria verificable completa", "Capacidad máxima de evidencias", "Máximo potencial de Trust Score"],
      monthlyPlanKey: "candidate_proplus_monthly",
      yearlyPlanKey: "candidate_proplus_yearly",
      cta: "Activar Pro+",
    },
  ];

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-slate-900">
      <h1 className="text-4xl font-semibold tracking-tight">Precios</h1>
      <p className="mt-4 max-w-3xl text-slate-600 leading-relaxed">
        Estructura de acceso simple: candidatos con planes progresivos y empresas con acceso
        al perfil verificable completo.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Candidatos</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {candidatePlans.map((plan) => (
            <article key={plan.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold text-slate-900">{plan.monthlyPrice}</p>
              {plan.yearlyPrice ? <p className="mt-1 text-sm font-medium text-slate-600">o {plan.yearlyPrice}</p> : null}
              <p className="mt-2 text-sm text-slate-600">{plan.summary}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              {plan.monthlyPlanKey ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startCheckout(plan.monthlyPlanKey!)}
                    disabled={loadingPlan !== null}
                    className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {loadingPlan === plan.monthlyPlanKey ? "Procesando…" : `${plan.cta} mensual`}
                  </button>
                  {plan.yearlyPlanKey ? (
                    <button
                      type="button"
                      onClick={() => startCheckout(plan.yearlyPlanKey!)}
                      disabled={loadingPlan !== null}
                      className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {loadingPlan === plan.yearlyPlanKey ? "Procesando…" : `${plan.cta} anual`}
                    </button>
                  ) : null}
                </div>
              ) : (
                <a
                  href="/signup"
                  className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  {plan.cta}
                </a>
              )}
            </article>
          ))}
        </div>
        {error ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Empresas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-5">
          {[
            { name: "Free", price: "0€" },
            { name: "Access", price: "49€" },
            { name: "Hiring", price: "99€" },
            { name: "Team", price: "199€" },
            { name: "Enterprise", price: "Contacto" },
          ].map((plan) => (
            <article key={plan.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold text-slate-900">{plan.price}</p>
              <p className="mt-2 text-sm text-slate-600">
                Acceso al perfil completo verificable según capacidades del plan.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Pago por uso</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Perfil individual</h3>
            <p className="mt-2 text-sm text-slate-600">
              Desbloqueo puntual del perfil verificable de un candidato.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Pack 5 perfiles</h3>
            <p className="mt-2 text-sm text-slate-600">
              Paquete para procesos con varias candidaturas simultáneas.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
