"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportIssue } from "@/lib/issueReport";

export default function NotFound() {
  useEffect(() => {
    reportIssue({
      http_status: 404,
      path: typeof location !== "undefined" ? location.pathname : "/",
      message: "Not Found (auto)",
      metadata: { source: "not-found" },
    });
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-semibold text-slate-500">VERIJOB</div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">No encontramos esa página</h1>
        <p className="mt-2 text-slate-600">
          Puede ser un enlace antiguo o una ruta mal enlazada. Vuelve al dashboard o a la web.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/dashboard" className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Ir al dashboard
          </Link>
          <a href="https://verijob.es" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90">
            Ver la web
          </a>
        </div>
      </div>
    </div>
  );
}
