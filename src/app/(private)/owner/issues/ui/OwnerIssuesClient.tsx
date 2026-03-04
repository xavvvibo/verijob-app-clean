"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  created_at: string;
  severity: "low" | "med" | "high";
  http_status: number;
  error_code: string | null;
  path: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
};

function fmtDate(s: string) {
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function OwnerIssuesClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    severity: "low",
    http_status: 404,
    error_code: "",
    path: "",
    message: "",
  });

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/issues", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "failed");
      setItems(data?.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => items, [items]);

  async function createManual() {
    setErr(null);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          severity: form.severity,
          http_status: Number(form.http_status),
          error_code: form.error_code || null,
          path: form.path || "/",
          message: form.message || "Sin descripción",
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
          metadata: { source: "manual_owner" },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "failed");
      setForm({ severity: "low", http_status: 404, error_code: "", path: "", message: "" });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "error");
    }
  }

  async function setStatus(id: string, status: "open" | "in_progress" | "resolved") {
    setErr(null);
    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "failed");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "error");
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Issue Desk</h1>
          <p className="mt-1 text-sm text-slate-600">Incidencias reportadas (404/500) y entradas manuales.</p>
        </div>

        <button
          onClick={createManual}
          className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Nueva incidencia
        </button>
      </div>

      {err ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <div className="md:col-span-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-6">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.severity}
              onChange={(e) => setForm((s) => ({ ...s, severity: e.target.value }))}
            >
              <option value="low">low</option>
              <option value="med">med</option>
              <option value="high">high</option>
            </select>

            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="number"
              value={form.http_status}
              onChange={(e) => setForm((s) => ({ ...s, http_status: Number(e.target.value) }))}
              placeholder="HTTP"
            />

            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              value={form.path}
              onChange={(e) => setForm((s) => ({ ...s, path: e.target.value }))}
              placeholder="Ruta (ej. /company/reuse)"
            />

            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.error_code}
              onChange={(e) => setForm((s) => ({ ...s, error_code: e.target.value }))}
              placeholder="Code (opcional)"
            />

            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-6"
              value={form.message}
              onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
              placeholder="Mini descripción"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Sev</th>
                <th className="px-4 py-3">HTTP</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Ruta</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody className="text-slate-800">
              {loading ? (
                <tr><td className="px-4 py-6 text-slate-600" colSpan={7}>Cargando…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td className="px-4 py-6 text-slate-600" colSpan={7}>No hay incidencias todavía.</td></tr>
              ) : (
                sorted.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(it.created_at)}</td>
                    <td className="px-4 py-3">{it.severity}</td>
                    <td className="px-4 py-3">{it.http_status}</td>
                    <td className="px-4 py-3">{it.error_code ?? "-"}</td>
                    <td className="px-4 py-3 font-medium">{it.path}</td>
                    <td className="px-4 py-3">{it.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setStatus(it.id, "in_progress")} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:opacity-90">En curso</button>
                        <button onClick={() => setStatus(it.id, "resolved")} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:opacity-90">Resolver</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
