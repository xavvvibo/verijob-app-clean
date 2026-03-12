"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import CommandSearch from "@/components/global/CommandSearch";
import { createClient } from "@/utils/supabase/client";
import { getCandidatePlanLabel } from "@/lib/candidate/plan-label";

type Role = "candidate" | "company" | "owner" | string | null | undefined;

function normalizeRole(role: Role) {
  const r = String(role || "").toLowerCase();
  if (r === "owner") return "owner";
  if (r === "company") return "company";
  return "candidate";
}

export default function Topbar({ role }: { role?: Role }) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const r = normalizeRole(role);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [companyPlanLabel, setCompanyPlanLabel] = useState<string | null>(null);
  const [candidatePlanLabel, setCandidatePlanLabel] = useState<string>("CANDIDATO FREE");

  const userPlanLabel = useMemo(() => {
    if (r === "owner") return "Plan Owner";
    if (r === "company") return `Plan Empresa ${companyPlanLabel || "Free"}`;
    return candidatePlanLabel;
  }, [candidatePlanLabel, companyPlanLabel, r]);

  const isCandidateArea = pathname === "/candidate" || pathname.startsWith("/candidate/");
  const forbiddenFlag = searchParams?.get("forbidden") === "1";
  const forbiddenFrom = String(searchParams?.get("from") || "");

  useEffect(() => {
    if (!(pathname === "/company" || pathname.startsWith("/company/"))) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/company/dashboard", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive || !res.ok || !data) return;
        setMembershipRole(typeof data.membership_role === "string" ? data.membership_role : null);
        setCompanyPlanLabel(typeof data.plan_label === "string" ? data.plan_label : null);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!(pathname === "/candidate" || pathname.startsWith("/candidate/"))) return;
    let alive = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) return;
        const { data } = await supabase
          .from("subscriptions")
          .select("plan,status")
          .eq("user_id", user.id)
          .in("status", ["active", "trialing", "trial", "past_due", "incomplete"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!alive) return;
        setCandidatePlanLabel(getCandidatePlanLabel((data as any)?.plan));
      } catch {
        if (!alive) return;
        setCandidatePlanLabel("CANDIDATO FREE");
      }
    })();
    return () => {
      alive = false;
    };
  }, [pathname, supabase]);

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
      <div className="mx-auto flex max-w-[1400px] flex-col px-6 py-3">
        {forbiddenFlag ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No tienes permisos para acceder a la zona <span className="font-semibold">{forbiddenFrom || "solicitada"}</span>. Te hemos llevado a tu área permitida.
          </div>
        ) : null}
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 items-center gap-4 lg:gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <span>{userPlanLabel}</span>
              {membershipRole && (pathname === "/company" || pathname.startsWith("/company/")) ? (
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">· {membershipRole}</span>
              ) : null}
            </div>
          </div>

          <div className="hidden flex-1 justify-center px-4 lg:flex">
            {r === "owner" ? <CommandSearch /> : null}
          </div>

          <div className="ml-auto flex items-center gap-2 lg:gap-3">
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
      </div>
    </header>
  );
}
