"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  email: string | null;
  role: string | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
  active_company_id: string | null;
};

export default function OwnerUsersPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const canPrev = offset > 0;
  const canNext = total == null ? rows.length === limit : offset + limit < total;

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    return p.toString();
  }, [q, limit, offset]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/users?${params}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "request_failed");
      setRows(Array.isArray(j?.users) ? j.users : []);
      setTotal(typeof j?.total === "number" ? j.total : null);
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Usuarios (Owner)</h1>
            <p className="text-sm text-gray-500">Listado desde public.profiles (id, email, role, onboarding).</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(e) => {
                setOffset(0);
                setQ(e.target.value);
              }}
              placeholder="Buscar (email / role / id)"
              className="h-10 w-72 rounded-lg border px-3 text-sm"
            />
            <select
              value={limit}
              onChange={(e) => {
                setOffset(0);
                setLimit(parseInt(e.target.value, 10));
              }}
              className="h-10 rounded-lg border px-3 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>

            <button
              onClick={() => load()}
              className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:opacity-90"
              disabled={loading}
            >
              {loading ? "Cargando…" : "Recargar"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-gray-600">
            {total != null ? (
              <>Total: <span className="font-medium text-gray-900">{total}</span> · Offset {offset} · Limit {limit}</>
            ) : (
              <>Offset {offset} · Limit {limit}</>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className="h-9 rounded-lg border px-3 text-sm disabled:opacity-50"
              disabled={!canPrev || loading}
              onClick={() => setOffset(Math.max(offset - limit, 0))}
            >
              ← Prev
            </button>
            <button
              className="h-9 rounded-lg border px-3 text-sm disabled:opacity-50"
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

        <div className="mt-4 overflow-auto">
          <table className="min-w-[1100px] w-full border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="border-b px-3 py-2">id</th>
                <th className="border-b px-3 py-2">email</th>
                <th className="border-b px-3 py-2">role</th>
                <th className="border-b px-3 py-2">onboarding</th>
                <th className="border-b px-3 py-2">created_at</th>
                <th className="border-b px-3 py-2">active_company_id</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="text-sm text-gray-900">
                  <td className="border-b px-3 py-2 font-mono text-xs">{r.id}</td>
                  <td className="border-b px-3 py-2">{r.email || "-"}</td>
                  <td className="border-b px-3 py-2">{r.role || "-"}</td>
                  <td className="border-b px-3 py-2">{typeof r.onboarding_completed === "boolean" ? (r.onboarding_completed ? "✅" : "—") : "-"}</td>
                  <td className="border-b px-3 py-2 font-mono text-xs">{r.created_at || "-"}</td>
                  <td className="border-b px-3 py-2 font-mono text-xs">{r.active_company_id || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    Sin resultados
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
