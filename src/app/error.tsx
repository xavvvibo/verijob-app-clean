"use client";

import { useEffect } from "react";
import Link from "next/link";
import ReportIssueButton from "@/components/admin/ReportIssueButton";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // evitamos log excesivo; si quieres, lo conectamos a un endpoint de logs en otra iteración
    console.error("GlobalError:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 p-8">
        <div className="text-xs font-semibold text-slate-500">VERIJOB</div>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Error interno</h1>
        <p className="mt-2 text-slate-600">
          Algo ha fallado. Puedes reintentar o volver al dashboard.
        </p>

        {error?.digest ? (
          <p className="mt-3 text-xs text-slate-500">
            Digest: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => reset()}
            className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Reintentar
          </button>
          <Link
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
            href="/dashboard"
          >
            Ir al dashboard
          </Link>
        </div>

        <ReportIssueButton httpStatus={500} defaultMessage="500 en app (GlobalError)" />
      </div>
    </div>
  );
}
