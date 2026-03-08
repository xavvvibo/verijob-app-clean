"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export const dynamic = "force-dynamic";

type CandidateCheckoutPlan =
  | "candidate_starter_monthly"
  | "candidate_pro_monthly"
  | "candidate_proplus_monthly"
  | "candidate_proplus_yearly";

type CandidateTier = "free" | "starter" | "pro" | "proplus_monthly" | "proplus_yearly";

type CheckoutOption = {
  label: string;
  planKey: CandidateCheckoutPlan;
};

export default function CandidateSubscriptionPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [currentTier, setCurrentTier] = useState<CandidateTier>("free");

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentSubscription() {
      setLoadingSubscription(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
          if (!cancelled) setCurrentTier("free");
          return;
        }

        const { data, error } = await supabase
          .from("subscriptions")
          .select("plan,status")
          .eq("user_id", user.id)
          .in("status", ["active", "trialing", "trial"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data?.plan) {
          if (!cancelled) setCurrentTier("free");
          return;
        }

        const plan = String(data.plan).trim().toLowerCase();
        if (plan === "candidate_starter_monthly") {
          if (!cancelled) setCurrentTier("starter");
          return;
        }
        if (plan === "candidate_pro_monthly") {
          if (!cancelled) setCurrentTier("pro");
          return;
        }
        if (plan === "candidate_proplus_monthly") {
          if (!cancelled) setCurrentTier("proplus_monthly");
          return;
        }
        if (plan === "candidate_proplus_yearly") {
          if (!cancelled) setCurrentTier("proplus_yearly");
          return;
        }

        if (!cancelled) setCurrentTier("free");
      } finally {
        if (!cancelled) setLoadingSubscription(false);
      }
    }

    loadCurrentSubscription();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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

  const currentPlanLabel = useMemo(() => {
    switch (currentTier) {
      case "starter":
        return "Candidato Starter";
      case "pro":
        return "Candidato Pro";
      case "proplus_monthly":
        return "Candidato Pro+ mensual";
      case "proplus_yearly":
        return "Candidato Pro+ anual";
      default:
        return "Candidato Free";
    }
  }, [currentTier]);

  const checkoutOptions = useMemo<CheckoutOption[]>(() => {
    if (currentTier === "starter") {
      return [
        { label: "Pro mensual", planKey: "candidate_pro_monthly" },
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
    if (currentTier === "proplus_yearly") {
      return [];
    }
    return [
      { label: "Starter mensual", planKey: "candidate_starter_monthly" },
      { label: "Pro mensual", planKey: "candidate_pro_monthly" },
      { label: "Pro+ mensual", planKey: "candidate_proplus_monthly" },
      { label: "Pro+ anual", planKey: "candidate_proplus_yearly" },
    ];
  }, [currentTier]);

  const recommendationText = useMemo(() => {
    if (currentTier === "proplus_yearly") {
      return "Ya tienes el nivel más alto activo. Puedes gestionar tu facturación cuando lo necesites.";
    }
    if (currentTier === "proplus_monthly") {
      return "Pasa a Pro+ anual para optimizar coste y mantener el máximo nivel de señales verificables.";
    }
    if (currentTier === "pro") {
      return "Sube a Pro+ para consolidar un perfil verificable de máxima solidez.";
    }
    if (currentTier === "starter") {
      return "Sube a Pro o Pro+ para reforzar credibilidad con más capacidad verificable.";
    }
    return "Elige el plan que mejor encaja con tu nivel de verificación.";
  }, [currentTier]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Suscripción</h1>
      <p className="text-sm text-gray-600">Consulta tu plan actual y mejora tu acceso cuando lo necesites.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Plan actual</h2>
          <p className="mt-2 text-sm text-gray-700">{loadingSubscription ? "Cargando plan…" : currentPlanLabel}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
            <li>Perfil verificable compartible</li>
            <li>Gestión de evidencias y verificaciones</li>
            <li>Panel de credibilidad profesional</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Mejorar plan</h2>
          <p className="mt-2 text-sm text-gray-600">{recommendationText}</p>
          <p className="mt-1 text-xs text-blue-700">Activa más señales verificables con un plan superior.</p>
          {checkoutOptions.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {checkoutOptions.map((plan) => (
                <button
                  key={plan.planKey}
                  onClick={() => startCheckout(plan.planKey)}
                  disabled={loadingPlan !== null}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {loadingPlan === plan.planKey ? "Procesando…" : plan.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Tu plan Pro+ anual ya está activo.
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/precios"
              className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Ver planes
            </a>
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
