"use client";

import { useState } from "react";

export default function ProfileViewCheckoutButtons({
  returnPath,
  upgradeUrl,
  compact = false,
}: {
  returnPath: string;
  upgradeUrl: string;
  compact?: boolean;
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function startCheckout(planKey: "company_single_cv" | "company_pack_5") {
    setLoadingKey(planKey);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan_key: planKey,
          return_path: returnPath,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        const raw = String(data?.error || "");
        if (raw.includes("missing_env")) {
          throw new Error("La compra no está disponible todavía porque falta la configuración de Stripe para este producto.");
        }
        throw new Error(data?.error || "No se pudo abrir el checkout en este momento.");
      }
      window.location.href = data.url;
    } catch (error: any) {
      setMessage(error?.message || "No se pudo abrir el checkout en este momento.");
    } finally {
      setLoadingKey(null);
    }
  }

  const buttonBase = compact
    ? "rounded-xl px-4 py-2 text-sm font-semibold"
    : "rounded-xl px-4 py-2.5 text-sm font-semibold";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void startCheckout("company_single_cv")}
          disabled={loadingKey !== null}
          className={`${buttonBase} bg-slate-900 text-white hover:bg-black disabled:opacity-60`}
        >
          {loadingKey === "company_single_cv" ? "Abriendo checkout…" : "Comprar 1 visualización"}
        </button>
        <button
          type="button"
          onClick={() => void startCheckout("company_pack_5")}
          disabled={loadingKey !== null}
          className={`${buttonBase} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-60`}
        >
          {loadingKey === "company_pack_5" ? "Abriendo checkout…" : "Comprar pack de 5 visualizaciones"}
        </button>
        <a
          className={`${buttonBase} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 inline-flex items-center`}
          href={upgradeUrl}
        >
          Mejorar plan empresa
        </a>
      </div>
      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}
    </div>
  );
}
