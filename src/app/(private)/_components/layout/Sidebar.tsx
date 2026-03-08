"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "candidate" | "company" | "owner" | string | null | undefined;

type Item = { href: string; label: string; badge?: string };
type Section = { title: string; items: Item[] };

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/candidate") return pathname === "/candidate" || pathname.startsWith("/candidate/");
  if (href === "/company") return pathname === "/company" || pathname.startsWith("/company/");
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

function getSections(role: Role): Section[] {
  const r = String(role || "").toLowerCase();

  // ==================
  // OWNER (superadmin)
  // ==================
  if (r === "owner") {
    return [
      {
        title: "Command Center",
        items: [
          { href: "/owner/overview", label: "Overview" },
          { href: "/owner/issues", label: "Issue Desk", badge: "LIVE" },
        ],
      },
      {
        title: "Core",
        items: [
          { href: "/owner/users", label: "Usuarios" },
          { href: "/owner/companies", label: "Empresas" },
          { href: "/owner/verifications", label: "Verificaciones" },
          { href: "/owner/evidences", label: "Evidencias" },
        ],
      },
      {
        title: "Growth & Revenue",
        items: [
          { href: "/owner/marketing", label: "Marketing & Growth" },
          { href: "/owner/monetization", label: "Monetización" },
        ],
      },
      {
        title: "Automatización & Operaciones",
        items: [
          { href: "/owner/ai-ops", label: "Procesamiento automático & Calidad" },
          { href: "/owner/settings", label: "Configuración" },
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
          { href: "/company/dashboard", label: "Inicio" },
          { href: "/company/requests", label: "Solicitudes" },
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
        { href: "/candidate/overview", label: "Inicio" },
        { href: "/candidate/profile", label: "Perfil" },
        { href: "/candidate/experiences", label: "Experiencias" },
        { href: "/candidate/education", label: "Educación" },
        { href: "/candidate/achievements", label: "Logros" },
        { href: "/candidate/evidence", label: "Evidencias" },
        { href: "/candidate/verifications", label: "Verificaciones" },
        { href: "/candidate/share", label: "Perfil público" },
      ],
    },
    {
      title: "Cuenta",
      items: [
        { href: "/candidate/subscription", label: "Suscripción" },
        { href: "/candidate/settings", label: "Ajustes" },
        { href: "/candidate/help", label: "Ayuda" },
      ],
    },
  ];
}

export default function Sidebar({ role }: { role?: Role }) {
  const pathname = usePathname() || "/";
  const sections = getSections(role);

  return (
    <aside className="sticky top-0 h-screen border-r border-slate-200 bg-white">
      <div className="flex h-full flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="Verijob" className="h-8 w-auto" />
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-slate-900">Verijob</div>
              <div className="text-[11px] font-semibold text-slate-500">
                {String(role || "candidate").toUpperCase()}
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
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
