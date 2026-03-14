"use client";

import Link from "next/link";
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
  metadata?: Record<string, any> | null;
};

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString("es-ES");
  } catch {
    return s;
  }
}

function severityLabel(v: string) {
  if (v === "high") return "Alta";
  if (v === "med") return "Media";
  return "Baja";
}

function statusLabel(v: string) {
  if (v === "in_progress") return "En curso";
  if (v === "resolved") return "Resuelta";
  return "Abierta";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default function OwnerIssuesClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "in_progress" | "resolved">("all");
  const [filterSeverity, setFilterSeverity] = useState<"all" | "low" | "med" | "high">("all");

  const [form, setForm] = useState({
    issue_type: "warning",
    severity: "med",
    http_status: 500,
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

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const open = items.filter((x) => x.status === "open").length;
    const inProgress = items.filter((x) => x.status === "in_progress").length;
    const resolved = items.filter((x) => x.status === "resolved").length;
    const high = items.filter((x) => x.severity === "high").length;
    return { open, inProgress, resolved, high };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (filterSeverity !== "all" && item.severity !== filterSeverity) return false;
      return true;
    });
  }, [items, filterSeverity, filterStatus]);

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
          metadata: { source: "manual_owner", issue_type: form.issue_type },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "failed");
      setForm({ issue_type: "warning", severity: "med", http_status: 500, error_code: "", path: "", message: "" });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "error");
    }
  }

  async function setStatus(id: string, status: "open" | "in_progress" | "resolved") {
    const safeId = String(id || "").trim();
    if (!isUuid(safeId)) {
      setErr("No se pudo actualizar la incidencia: identificador inválido.");
      return;
    }
    setErr(null);
    try {
      const res = await fetch(`/api/issues/${safeId}`, {
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
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Centro de incidencias</h1>
        <p className="mt-1 text-sm text-slate-600">
          Centro operativo de incidencias para seguimiento, priorización y resolución.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Abiertas</div>
            <div className="text-xl font-semibold text-slate-900">{stats.open}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">En curso</div>
            <div className="text-xl font-semibold text-slate-900">{stats.inProgress}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Resueltas</div>
            <div className="text-xl font-semibold text-slate-900">{stats.resolved}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Severidad alta</div>
            <div className="text-xl font-semibold text-slate-900">{stats.high}</div>
          </div>
        </div>
      </section>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Nueva incidencia manual</h2>
        <p className="mt-1 text-sm text-slate-600">Registra incidencias operativas detectadas fuera del flujo automático.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.issue_type}
            onChange={(e) => setForm((s) => ({ ...s, issue_type: e.target.value }))}
          >
            <option value="warning">warning</option>
            <option value="error">error</option>
            <option value="system">system</option>
          </select>

          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.severity}
            onChange={(e) => setForm((s) => ({ ...s, severity: e.target.value }))}
          >
            <option value="low">Baja</option>
            <option value="med">Media</option>
            <option value="high">Alta</option>
          </select>

          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="number"
            value={form.http_status}
            onChange={(e) => setForm((s) => ({ ...s, http_status: Number(e.target.value) }))}
            placeholder="HTTP"
          />

          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            value={form.path}
            onChange={(e) => setForm((s) => ({ ...s, path: e.target.value }))}
            placeholder="Ruta (ej. /company/reuse)"
          />

          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.error_code}
            onChange={(e) => setForm((s) => ({ ...s, error_code: e.target.value }))}
            placeholder="Código"
          />

          <button
            onClick={createManual}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Crear incidencia
          </button>

          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-6"
            value={form.message}
            onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
            placeholder="Descripción operativa"
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">Estado: todos</option>
            <option value="open">Abiertas</option>
            <option value="in_progress">En curso</option>
            <option value="resolved">Resueltas</option>
          </select>

          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as any)}
          >
            <option value="all">Severidad: todas</option>
            <option value="high">Alta</option>
            <option value="med">Media</option>
            <option value="low">Baja</option>
          </select>

          <button
            onClick={() => {
              setFilterStatus("all");
              setFilterSeverity("all");
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Severidad</th>
                <th className="px-3 py-3">HTTP</th>
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3">Ruta</th>
                <th className="px-3 py-3">Mensaje</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>

            <tbody className="text-slate-800">
              {loading ? (
                <tr><td className="px-3 py-6 text-slate-600" colSpan={9}>Cargando incidencias…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-3 py-6 text-slate-600" colSpan={9}>No hay incidencias para los filtros aplicados.</td></tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(it.created_at)}</td>
                    <td className="px-3 py-3">{String((it.metadata as any)?.issue_type || "warning")}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{severityLabel(it.severity)}</td>
                    <td className="px-3 py-3">{it.http_status || "—"}</td>
                    <td className="px-3 py-3">{it.error_code ?? "-"}</td>
                    <td className="px-3 py-3 font-medium">
                      <div>{it.path}</div>
                      {String(it.path || "").startsWith("/") ? (
                        <Link href={it.path} className="mt-1 inline-flex text-xs font-semibold text-slate-700 underline">
                          Abrir ruta
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 max-w-[340px] truncate" title={it.message}>{it.message || "Sin descripción"}</td>
                    <td className="px-3 py-3">{statusLabel(it.status)}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          disabled={!isUuid(String(it.id || "")) || it.status === "in_progress"}
                          onClick={() => setStatus(it.id, "in_progress")}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          En curso
                        </button>
                        <button
                          disabled={!isUuid(String(it.id || "")) || it.status === "resolved"}
                          onClick={() => setStatus(it.id, "resolved")}
                          className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Marcar como resuelto
                        </button>
                      </div>
                      {!isUuid(String(it.id || "")) ? (
                        <div className="mt-1 text-[11px] text-amber-700">ID inválido: acción deshabilitada</div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
