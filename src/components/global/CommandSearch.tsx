"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type SearchCompany = {
  id: string;
  name: string | null;
  status: string | null;
};

type SearchVerification = {
  id: string;
  status: string | null;
  candidate_name: string;
  company_name: string;
};

export default function CommandSearch() {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ users: SearchUser[]; companies: SearchCompany[]; verifications: SearchVerification[] }>({
    users: [],
    companies: [],
    verifications: [],
  });
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (value.trim().length < 2) {
      setResults({ users: [], companies: [], verifications: [] });
      setOpen(false);
      return;
    }

    let alive = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/internal/owner/search?q=${encodeURIComponent(value.trim())}&limit=6`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setResults({
          users: Array.isArray(data?.users) ? data.users : [],
          companies: Array.isArray(data?.companies) ? data.companies : [],
          verifications: Array.isArray(data?.verifications) ? data.verifications : [],
        });
        setOpen(true);
      } catch {
        if (!alive) return;
        setResults({ users: [], companies: [], verifications: [] });
        setOpen(true);
      } finally {
        if (alive) setLoading(false);
      }
    }, 180);

    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const totalResults = results.users.length + results.companies.length + results.verifications.length;

  function navigateTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={rootRef} className="relative hidden lg:block">
      <label className="sr-only" htmlFor="owner-command-search">
        Buscar
      </label>
      <input
        id="owner-command-search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          if (value.trim().length >= 2) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && results.users[0]) {
            event.preventDefault();
            navigateTo(`/owner/users/${results.users[0].id}`);
          }
        }}
        placeholder="Buscar usuario, empresa o verificación"
        className="w-[360px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
      />
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[520px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          {loading ? <p className="px-2 py-3 text-sm text-slate-600">Buscando…</p> : null}
          {!loading && value.trim().length < 2 ? (
            <p className="px-2 py-3 text-sm text-slate-600">Escribe al menos 2 caracteres para buscar en owner.</p>
          ) : null}
          {!loading && value.trim().length >= 2 && totalResults === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-600">No hay resultados para esta búsqueda.</p>
          ) : null}
          {!loading && totalResults > 0 ? (
            <div className="space-y-3">
              {results.users.length ? (
                <ResultSection title="Usuarios">
                  {results.users.map((row) => (
                    <button
                      key={row.id}
                      onClick={() => navigateTo(`/owner/users/${row.id}`)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.full_name || row.email || "Usuario sin nombre"}</p>
                        <p className="text-xs text-slate-500">{row.email || "Sin email"} · {row.role || "sin rol"}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-500">Usuario</span>
                    </button>
                  ))}
                </ResultSection>
              ) : null}
              {results.companies.length ? (
                <ResultSection title="Empresas">
                  {results.companies.map((row) => (
                    <button
                      key={row.id}
                      onClick={() => navigateTo(`/owner/companies/${row.id}`)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.name || "Empresa sin nombre"}</p>
                        <p className="text-xs text-slate-500">Estado: {row.status || "sin clasificar"}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-500">Empresa</span>
                    </button>
                  ))}
                </ResultSection>
              ) : null}
              {results.verifications.length ? (
                <ResultSection title="Verificaciones">
                  {results.verifications.map((row) => (
                    <button
                      key={row.id}
                      onClick={() => navigateTo(`/owner/verifications/${row.id}`)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.company_name || "Empresa"} · {row.candidate_name || "Candidato"}</p>
                        <p className="text-xs text-slate-500">#{row.id.slice(0, 8)} · {row.status || "sin estado"}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-500">Verificación</span>
                    </button>
                  ))}
                </ResultSection>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 border-t border-slate-100 px-2 pt-3 text-[11px] text-slate-500">
            Búsqueda transversal owner sobre usuarios, empresas y verificaciones.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
