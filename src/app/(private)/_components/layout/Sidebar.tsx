"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  match?: "exact" | "prefix";
};

function isActive(pathname: string, item: NavItem) {
  const mode = item.match ?? "prefix";
  if (mode === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function Item({ item }: { item: NavItem }) {
  const pathname = usePathname() || "/";
  const active = isActive(pathname, item);

  return (
    <Link
      href={item.href}
      className={[
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-2 w-2 rounded-full",
          active ? "bg-white" : "bg-slate-300",
        ].join(" ")}
      />
      <span className="font-medium">{item.label}</span>
    </Link>
  );
}

function Section({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((it) => (
          <Item key={it.href} item={it} />
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname() || "/";
  const inCandidate = pathname === "/candidate" || pathname.startsWith("/candidate/");
  const inCompany = pathname === "/company" || pathname.startsWith("/company/");
  const inDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Rutas reales (inventario confirmado por ti)
  const candidateNav: NavItem[] = [
    { label: "Dashboard", href: "/candidate/overview", match: "exact" },
    { label: "Perfil", href: "/candidate/profile" },
    { label: "CV & Experiencias", href: "/candidate/experience" },
    { label: "Evidencias", href: "/candidate/evidence" },
    { label: "Verificaciones", href: "/candidate/verifications" },
    { label: "CV público", href: "/candidate/profile-share", match: "exact" },
    { label: "Ajustes", href: "/candidate/settings", match: "exact" },
  ];

  const companyNav: NavItem[] = [
    { label: "Dashboard", href: "/company/dashboard", match: "exact" },
    { label: "Solicitudes", href: "/company/requests", match: "exact" },
    { label: "Reutilización", href: "/company/reuse", match: "exact" },
  ];

  // Link “home” del área privada (no marketing)
  const topLinks: NavItem[] = [
    { label: "Inicio", href: "/dashboard", match: "exact" },
  ];

  // Si está dentro de candidate/company, muestra el menú de ese contexto.
  // Si está en /dashboard (hub), solo muestra “Inicio” para no confundir.
  const showCandidate = inCandidate && !inCompany;
  const showCompany = inCompany && !inCandidate;

  return (
    <aside className="h-full w-[260px] shrink-0 border-r border-slate-200 bg-white">
      <div className="flex h-full flex-col gap-6 p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3">
          <div className="h-8 w-8 overflow-hidden rounded-xl bg-slate-100">
            {/* Logo (si existe en public/brand/logo.png) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="Verijob" className="h-8 w-8 object-contain" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-slate-900">VERIJOB</div>
            <div className="text-xs text-slate-500">Trust Infrastructure</div>
          </div>
        </div>

        <Section title="Navegación" items={topLinks} />

        {showCandidate && <Section title="Candidato" items={candidateNav} />}
        {showCompany && <Section title="Empresa" items={companyNav} />}

        {inDashboard && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Selecciona tu contexto: <b>Candidato</b> o <b>Empresa</b>.
          </div>
        )}

        <div className="mt-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
          Consejo: completa <b>Perfil</b> + <b>CV & Experiencias</b> para mejorar tu credibilidad.
        </div>
      </div>
    </aside>
  );
}
