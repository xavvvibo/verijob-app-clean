"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "candidate" | "company" | "owner" | string | null | undefined;

function normalizeRole(role: Role) {
  const r = String(role || "").toLowerCase();
  if (r === "owner") return "owner";
  if (r === "company") return "company";
  return "candidate";
}

export default function Topbar({ role }: { role?: Role }) {
  const pathname = usePathname() || "/";
  const r = normalizeRole(role);

  const scopeLabel = useMemo(() => {
    if (r === "owner") return "Owner";
    if (pathname === "/company" || pathname.startsWith("/company/")) return "Empresa";
    if (pathname === "/candidate" || pathname.startsWith("/candidate/")) return "Candidato";
    return r === "company" ? "Empresa" : "Candidato";
  }, [pathname, r]);

  const contextHref = useMemo(() => {
    if (r === "owner") return "/owner/overview";
    if (r === "company") return "/company/dashboard";
    return "/candidate/overview";
  }, [r]);

  const contextCtaLabel = useMemo(() => {
    if (r === "owner") return "Ir al contexto owner";
    if (r === "company") return "Ir al contexto empresa";
    return "Ir al contexto candidato";
  }, [r]);

  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="Verijob"
              className="h-10 w-auto"
              loading="eager"
            />
          </Link>

          <div className="hidden md:block text-xs font-semibold text-slate-500">
            {scopeLabel}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://verijob.es"
            className="hidden sm:inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
          >
            Web
          </a>

          <Link
            href={contextHref}
            className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {contextCtaLabel}
          </Link>

          <button
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            title="Cerrar sesión"
          >
            {loggingOut ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </header>
  );
}
