"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CommandSearch from "@/components/global/CommandSearch";

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
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [companyPlanLabel, setCompanyPlanLabel] = useState<string | null>(null);

  const scopeLabel = useMemo(() => {
    if (r === "owner") return "Owner";
    if (pathname === "/company" || pathname.startsWith("/company/")) return companyName || "Empresa";
    if (pathname === "/candidate" || pathname.startsWith("/candidate/")) return "Candidato";
    return r === "company" ? "Empresa" : "Candidato";
  }, [companyName, pathname, r]);

  const userPlanLabel = useMemo(() => {
    if (r === "owner") return "Plan Owner";
    if (r === "company") return `Plan Empresa ${companyPlanLabel || "Free"}`;
    return "Plan Candidato";
  }, [companyPlanLabel, r]);

  const isCandidateArea = pathname === "/candidate" || pathname.startsWith("/candidate/");

  useEffect(() => {
    if (!(pathname === "/company" || pathname.startsWith("/company/"))) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/company/dashboard", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive || !res.ok || !data) return;
        setCompanyName(typeof data.company_name === "string" ? data.company_name : null);
        setMembershipRole(typeof data.membership_role === "string" ? data.membership_role : null);
        setCompanyPlanLabel(typeof data.plan_label === "string" ? data.plan_label : null);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [pathname]);

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

          <div className="hidden md:block">
            <div className="text-xs font-semibold text-slate-500">{scopeLabel}</div>
            {membershipRole && (pathname === "/company" || pathname.startsWith("/company/")) ? (
              <div className="text-[11px] text-slate-400 uppercase tracking-wide">Rol: {membershipRole}</div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {r === "owner" ? <CommandSearch /> : null}

          <div className="hidden md:inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
            {userPlanLabel}
          </div>

          {isCandidateArea ? (
            <>
              <Link
                href="/candidate/subscription"
                className="hidden lg:inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Planes
              </Link>
              <Link
                href="/candidate/settings"
                className="hidden lg:inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Ajustes
              </Link>
            </>
          ) : null}

          <a
            href="https://verijob.es"
            className="hidden sm:inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
          >
            Web
          </a>

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
