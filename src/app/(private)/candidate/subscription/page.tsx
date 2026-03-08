"use client";

import { useState } from "react";

export const dynamic = "force-dynamic";

export default function CandidateSubscriptionPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function goCheckout(planKey: string) {
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
        throw new Error(data?.error || "No se pudo iniciar el checkout");
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
        throw new Error(data?.error || "No hay facturación activa para gestionar.");
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
      <h1 className="text-2xl font-semibold text-gray-900">Suscripción</h1>
      <p className="text-sm text-gray-600">Consulta tu plan actual y mejora tu acceso cuando lo necesites.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Plan actual</h2>
          <p className="mt-2 text-sm text-gray-700">Candidato PRO</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
            <li>Perfil verificable compartible</li>
            <li>Gestión de evidencias y verificaciones</li>
            <li>Panel de credibilidad profesional</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Siguiente plan recomendado</h2>
          <p className="mt-2 text-sm text-gray-600">Pro+ anual para ampliar señales verificables y uso intensivo.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => goCheckout("candidate_proplus_yearly")}
              disabled={loadingPlan !== null}
              className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {loadingPlan === "candidate_proplus_yearly" ? "Procesando…" : "Mejorar plan"}
            </button>
            <button
              onClick={() => goCheckout("candidate_starter_monthly")}
              disabled={loadingPlan !== null}
              className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
            >
              Ver planes
            </button>
            <button
              onClick={openPortal}
              disabled={loadingPortal}
              className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
            >
              {loadingPortal ? "Abriendo…" : "Gestionar facturación"}
            </button>
          </div>
        </section>
      </div>

      {message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>
      ) : null}
    </div>
  );
}
