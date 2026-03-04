"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  role?: string;
};

function Item({ href, label }: { href: string; label: string }) {
  const pathname = usePathname() || "/";
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", active ? "bg-white" : "bg-slate-300"].join(" ")} />
      {label}
    </Link>
  );
}

export default function Sidebar({ role = "candidate" }: Props) {
  const isCompany = role === "company" || role === "admin" || role === "recruiter" || role === "reviewer";

  return (
    <aside className="border-r border-slate-200 bg-white">
      <div className="p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png?v=20260304" alt="Verijob" className="h-10 w-auto" />
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-slate-900">VERIJOB</div>
            <div className="text-xs text-slate-500">Trust Infrastructure</div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-1 mt-2">Navegación</div>
        <div className="mt-2 space-y-1">
          <Item href="/dashboard" label="Inicio" />
        </div>

        <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-1 mt-5">
          {isCompany ? "Empresa" : "Candidato"}
        </div>

        {isCompany ? (
          <div className="mt-2 space-y-1">
            <Item href="/company/dashboard" label="Dashboard" />
            <Item href="/company/requests" label="Solicitudes" />
            <Item href="/company/reuse" label="Reutilización" />
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            <Item href="/candidate/overview" label="Dashboard" />
            <Item href="/candidate/experience" label="Experiencias" />
            <Item href="/candidate/evidence" label="Evidencias" />
            <Item href="/candidate/verifications" label="Verificaciones" />
            <Item href="/candidate/share" label="Compartir perfil" />
            <Item href="/candidate/settings" label="Ajustes" />
          </div>
        )}
      </div>
    </aside>
  );
}
