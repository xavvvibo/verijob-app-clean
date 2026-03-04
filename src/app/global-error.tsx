"use client";

import { useEffect } from "react";
import { reportIssue } from "@/lib/issueReport";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportIssue({
      http_status: 500,
      error_code: error?.digest ?? null,
      path: typeof location !== "undefined" ? location.pathname : "/",
      message: error?.message ?? "Global error (auto)",
      metadata: { source: "global-error" },
    });
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">VERIJOB</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">500 · Internal Server Error</h1>
            <p className="mt-2 text-slate-600">
              Ha ocurrido un error. Ya lo hemos registrado para revisión.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => reset()} className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Reintentar
              </button>
              <a href="https://verijob.es" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90">
                Ver la web
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
