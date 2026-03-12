"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OwnerTooltip from "@/components/ui/OwnerTooltip";

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
  active_company_id: string | null;
  active_company_name: string | null;
  experiences_count: number;
  verifications_count: number;
  verifications_verified_count: number;
  evidences_count: number;
  plan: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  trust_score: number | null;
  last_activity_at: string | null;
  lifecycle_status?: string | null;
  deleted_at?: string | null;
};

const ROLE_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "candidate", label: "Candidato" },
  { value: "company", label: "Empresa" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
] as const;

const QUICK_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "active_only", label: "Solo activos" },
  { value: "deleted", label: "Archivados" },
  { value: "onboarding_incomplete", label: "Onboarding incompleto" },
  { value: "with_company", label: "Con empresa activa" },
  { value: "without_company", label: "Sin empresa activa" },
] as const;

function fmtDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function roleBadge(role: string | null) {
  const r = String(role || "").toLowerCase();
  if (r === "owner" || r === "admin") return "border-purple-200 bg-purple-50 text-purple-700";
  if (r === "company") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (r === "candidate") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function OwnerUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [quick, setQuick] = useState("all");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState({
    candidates: 0,
    companies: 0,
    owners: 0,
    onboarding_incomplete: 0,
    with_active_company: 0,
    archived: 0,
  });

  const canPrev = offset > 0;
  const canNext = total == null ? rows.length === limit : offset + limit < total;

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (role !== "all") p.set("role", role);
    if (quick !== "all") p.set("quick", quick);
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    p.set("_ts", String(Date.now()));
    return p.toString();
  }, [q, role, quick, limit, offset, refreshKey]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/users?${params}`, {
        cache: "no-store",
        credentials: "include",
        headers: { "cache-control": "no-store" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "request_failed");
      setRows(Array.isArray(j?.users) ? j.users : []);
      setTotal(typeof j?.total === "number" ? j.total : null);
      setSummary({
        candidates: Number(j?.summary?.candidates || 0),
        companies: Number(j?.summary?.companies || 0),
        owners: Number(j?.summary?.owners || 0),
        onboarding_incomplete: Number(j?.summary?.onboarding_incomplete || 0),
        with_active_company: Number(j?.summary?.with_active_company || 0),
        archived: Number(j?.summary?.archived || 0),
      });
    } catch (e: any) {
      setErr(e?.message || "load_failed");
      setRows([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const kpis = useMemo(() => {
    return {
      candidates: summary.candidates,
      companies: summary.companies,
      owners: summary.owners,
      incomplete: summary.onboarding_incomplete,
      withCompany: summary.with_active_company,
      archived: summary.archived,
    };
  }, [summary]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Centro de usuarios</h1>
        <p className="mt-1 text-sm text-slate-600">
          Consola operativa de usuarios para soporte, revisión y monetización. Incluye búsqueda real, métricas y acceso a ficha owner.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Candidatos</div>
            <div className="text-xl font-semibold text-slate-900">{kpis.candidates}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Empresas</div>
            <div className="text-xl font-semibold text-slate-900">{kpis.companies}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Onboarding incompleto</div>
            <div className="text-xl font-semibold text-slate-900">{kpis.incomplete}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Con empresa activa</div>
            <div className="text-xl font-semibold text-slate-900">{kpis.withCompany}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Archivados</div>
            <div className="text-xl font-semibold text-slate-900">{kpis.archived}</div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
            placeholder="Buscar por email, nombre, id, rol, company id o company name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={role}
            onChange={(e) => {
              setOffset(0);
              setRole(e.target.value);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {ROLE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            value={quick}
            onChange={(e) => {
              setOffset(0);
              setQuick(e.target.value);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {QUICK_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={limit}
            onChange={(e) => {
              setOffset(0);
              setLimit(parseInt(e.target.value, 10));
            }}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>

          <button
            onClick={() => setRefreshKey((v) => v + 1)}
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:opacity-90"
            disabled={loading}
          >
            {loading ? "Cargando…" : "Recargar"}
          </button>

          <button
            onClick={() => {
              setOffset(0);
              setQ("");
              setRole("all");
              setQuick("all");
              setRefreshKey((v) => v + 1);
            }}
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"
            disabled={loading}
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            {total != null ? (
              <>Total: <span className="font-medium text-slate-900">{total}</span> · Offset {offset} · Limit {limit}</>
            ) : (
              <>Offset {offset} · Limit {limit}</>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className="h-9 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50"
              disabled={!canPrev || loading}
              onClick={() => setOffset(Math.max(offset - limit, 0))}
            >
              ← Prev
            </button>
            <button
              className="h-9 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50"
              disabled={!canNext || loading}
              onClick={() => setOffset(offset + limit)}
            >
              Next →
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Error: {err}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-hidden">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="border-b border-slate-200 px-3 py-2">Email</th>
                <th className="border-b border-slate-200 px-3 py-2">Rol</th>
                <th className="border-b border-slate-200 px-3 py-2">Plan</th>
                <th className="border-b border-slate-200 px-3 py-2">Empresa</th>
                <th className="border-b border-slate-200 px-3 py-2">Actividad</th>
                <th className="border-b border-slate-200 px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    Métricas
                    <OwnerTooltip text="Incluye experiencias, verificaciones y evidencias. Trust Score representa el grado de verificación del perfil profesional." />
                  </span>
                </th>
                <th className="border-b border-slate-200 px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="text-slate-900">
                  <td className="border-b border-slate-100 px-3 py-2">
                    <div className="truncate text-sm font-medium text-slate-900" title={r.email || "-"}>
                      {r.email || "-"}
                    </div>
                    <div className="truncate text-xs text-slate-500" title={r.full_name || "-"}>
                      {r.full_name || "Sin nombre"}
                    </div>
                    {String(r.lifecycle_status || "active").toLowerCase() === "deleted" ? (
                      <div className="mt-1 inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        ELIMINADO
                      </div>
                    ) : null}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${roleBadge(r.role)}`}>
                      {r.role || "-"}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <div className="font-medium text-slate-900">{r.plan || "free"}</div>
                    <div className="text-xs text-slate-500">{r.subscription_status || "sin suscripción activa"}</div>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <div className="truncate text-xs text-slate-700" title={r.active_company_name || "Sin empresa activa"}>
                      {r.active_company_name || "Sin empresa activa"}
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-700">{fmtDate(r.last_activity_at)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-700">
                    Exp {r.experiences_count} · Verif {r.verifications_count} · Ev {r.evidences_count}
                    {typeof r.trust_score === "number" ? ` · Trust ${r.trust_score}` : ""}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <Link
                      href={`/owner/users/${encodeURIComponent(r.id)}`}
                      className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                    Sin resultados con los filtros actuales.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
