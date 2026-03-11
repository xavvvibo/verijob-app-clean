"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "candidate" | "company" | "owner" | string | null | undefined;

type Item = { href: string; label: string; badge?: string; disabled?: boolean };
type Section = { title: string; items: Item[] };

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/candidate") return pathname === "/candidate" || pathname.startsWith("/candidate/");
  if (href === "/company") {
    return pathname === "/company" || pathname === "/company/dashboard" || pathname === "/company/dashboard-v4";
  }
  if (href === "/owner") return pathname === "/owner" || pathname.startsWith("/owner/");
  return pathname === href || pathname.startsWith(href + "/");
}

function NavSection({ title, items, pathname }: { title: string; items: Item[]; pathname: string }) {
  return (
    <div className="mb-6">
      <div className="px-3 text-[11px] font-bold tracking-wide text-slate-500 uppercase">{title}</div>
      <div className="mt-2 space-y-1">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          if (it.disabled) {
            return (
              <div
                key={it.href}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-400"
                title="Completa el onboarding para desbloquear esta sección"
              >
                <span className="truncate">{it.label}</span>
                <span className="ml-3 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                  BLOQUEADO
                </span>
              </div>
            );
          }
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <span className="truncate">{it.label}</span>
              {it.badge ? (
                <span className={["ml-3 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  active ? "bg-white/15 text-white" : "bg-slate-200 text-slate-700"].join(" ")}>
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function getSections(role: Role, candidateOnboardingLocked = false): Section[] {
  const r = String(role || "").toLowerCase();

  // ==================
  // OWNER (superadmin)
  // ==================
  if (r === "owner") {
    return [
      {
        title: "CORE",
        items: [
          { href: "/owner/overview", label: "Overview" },
          { href: "/owner/users", label: "Users" },
          { href: "/owner/companies", label: "Companies" },
          { href: "/owner/verifications", label: "Verifications" },
          { href: "/owner/evidences", label: "Evidence" },
        ],
      },
      {
        title: "GROWTH",
        items: [
          { href: "/owner/growth", label: "Growth" },
          { href: "/owner/marketing", label: "Marketing" },
          { href: "/owner/monetization", label: "Monetización" },
        ],
      },
      {
        title: "OPERATIONS",
        items: [
          { href: "/owner/ai-ops", label: "Automatic Processing" },
          { href: "/owner/issues", label: "Issue Desk", badge: "LIVE" },
          { href: "/owner/settings", label: "Settings" },
        ],
      },
    ];
  }

  // ==========
  // COMPANY
  // ==========
  if (r === "company") {
    return [
      {
        title: "Empresa",
        items: [
          { href: "/company", label: "Dashboard" },
          { href: "/company/profile", label: "Perfil de empresa" },
          { href: "/company/requests", label: "Solicitudes" },
          { href: "/company/reuse", label: "Reutilización" },
          { href: "/company/candidates", label: "Candidatos" },
        ],
      },
      {
        title: "Gestión",
        items: [
          { href: "/company/team", label: "Equipo & Permisos" },
          { href: "/company/billing", label: "Suscripción" },
          { href: "/company/settings", label: "Ajustes" },
          { href: "/company/help", label: "Ayuda" },
        ],
      },
    ];
  }

  // ==========
  // CANDIDATE (default)
  // ==========
  return [
    {
      title: "Candidato",
      items: [
        { href: "/candidate/overview", label: "Inicio", disabled: candidateOnboardingLocked },
        { href: "/candidate/profile", label: "Perfil", disabled: candidateOnboardingLocked },
        { href: "/candidate/experience", label: "Experiencias", disabled: candidateOnboardingLocked },
        { href: "/candidate/education", label: "Educación", disabled: candidateOnboardingLocked },
        { href: "/candidate/achievements", label: "Idiomas y logros", disabled: candidateOnboardingLocked },
        { href: "/candidate/evidence", label: "Evidencias", disabled: candidateOnboardingLocked },
        { href: "/candidate/verifications", label: "Verificaciones", disabled: candidateOnboardingLocked },
        { href: "/candidate/share", label: "Perfil público", disabled: candidateOnboardingLocked },
      ],
    },
    {
      title: "Cuenta",
      items: [
        { href: "/candidate/subscription", label: "Suscripción", disabled: candidateOnboardingLocked },
        { href: "/candidate/settings", label: "Ajustes", disabled: candidateOnboardingLocked },
        { href: "/candidate/help", label: "Ayuda", disabled: candidateOnboardingLocked },
      ],
    },
  ];
}

export default function Sidebar({ role }: { role?: Role }) {
  const pathname = usePathname() || "/";
  const normalizedRole = String(role || "candidate").toLowerCase();
  const candidateOnboardingLocked = normalizedRole === "candidate" && pathname.startsWith("/onboarding");
  const sections = getSections(role, candidateOnboardingLocked);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyPlanLabel, setCompanyPlanLabel] = useState<string | null>(null);

  useEffect(() => {
    if (normalizedRole !== "company") return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/company/dashboard", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive || !res.ok || !data) return;
        setCompanyName(typeof data.company_name === "string" ? data.company_name : null);
        setCompanyPlanLabel(typeof data.plan_label === "string" ? data.plan_label : null);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [normalizedRole]);

  return (
    <aside className="sticky top-0 h-screen border-r border-slate-200 bg-white">
      <div className="flex h-full flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/verijob-logo-compact.png" alt="Verijob" className="h-8 w-auto" />
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-slate-900">Verijob</div>
              <div className="text-[11px] font-semibold text-slate-500">
                {normalizedRole === "company"
                  ? companyName || "Tu empresa"
                  : String(role || "candidate").toUpperCase()}
              </div>
              {normalizedRole === "company" ? (
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                  Plan {companyPlanLabel || "Free"}
                </div>
              ) : null}
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {candidateOnboardingLocked ? (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">
              Completa el onboarding para desbloquear el resto del panel candidato.
            </div>
          ) : null}
          {sections.map((s) => (
            <NavSection key={s.title} title={s.title} items={s.items} pathname={pathname} />
          ))}
        </nav>

        <div className="px-3 pb-4">
          <a
            href="https://verijob.es"
            className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Ir a la web
          </a>
        </div>
      </div>
    </aside>
  );
}
