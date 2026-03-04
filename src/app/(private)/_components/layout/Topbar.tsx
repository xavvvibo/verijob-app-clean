"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Topbar() {
  const pathname = usePathname() || "/";
  const inCandidate = pathname === "/candidate" || pathname.startsWith("/candidate/");
  const inCompany = pathname === "/company" || pathname.startsWith("/company/");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="Verijob"
              className="h-11 w-auto"
              loading="eager"
            />
          </Link>

          <div className="hidden md:block text-xs font-semibold text-slate-500">
            {inCandidate ? "Candidato" : inCompany ? "Empresa" : "Dashboard"}
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
            href={inCompany ? "/company/dashboard" : "/candidate/overview"}
            className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Ir al contexto
          </Link>
        </div>
      </div>
    </header>
  );
}
