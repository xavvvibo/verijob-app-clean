"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewIssuePage() {
  const r = useRouter();
  const [severity, setSeverity] = useState("medium");
  const [httpStatus, setHttpStatus] = useState<number>(500);
  const [path, setPath] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          severity,
          http_status: httpStatus,
          error_code: httpStatus === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
          path: path || null,
          method: "GET",
          request_id: (globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`),
          message_short: message,
          details_json: {},
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "No se pudo crear la incidencia.");
        return;
      }

      r.push("/owner/issues");
      r.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo crear la incidencia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[720px]">
      <h1 className="text-2xl font-extrabold text-slate-900">Nueva incidencia</h1>

      <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <div className="font-semibold text-slate-700">Severidad</div>
            <select className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>

          <label className="text-sm">
            <div className="font-semibold text-slate-700">HTTP</div>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
              type="number" value={httpStatus} onChange={(e) => setHttpStatus(Number(e.target.value))} />
          </label>
        </div>

        <label className="text-sm block">
          <div className="font-semibold text-slate-700">Ruta (opcional)</div>
          <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
            value={path} onChange={(e) => setPath(e.target.value)} placeholder="/candidate/..." />
        </label>

        <label className="text-sm block">
          <div className="font-semibold text-slate-700">Descripción corta</div>
          <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Qué pasó y dónde" required />
        </label>

        {err ? <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">{err}</div> : null}

        <button disabled={busy} className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {busy ? "Creando…" : "Crear incidencia"}
        </button>
      </form>
    </div>
  );
}
