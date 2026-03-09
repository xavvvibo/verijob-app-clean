"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ReuseEvent = {
  verificationId: string;
  at: string;
  status: "ok" | "error";
  message: string;
};

export default function ReuseClient() {
  const sp = useSearchParams();
  const initialId = useMemo(() => (sp ? sp.get("id") || sp.get("verification_id") || "" : ""), [sp]);

  const [verificationId, setVerificationId] = useState(initialId);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<ReuseEvent[]>([]);

  async function submitReuse() {
    const value = verificationId.trim();
    if (!value) {
      setMessage("Indica un identificador de verificación para continuar.");
      return;
    }

    try {
      setBusy(true);
      setMessage(null);

      const response = await fetch("/api/company/reuse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verification_id: value }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = data?.error || "No se pudo reutilizar la verificación.";
        setEvents((prev) => [{ verificationId: value, at: new Date().toISOString(), status: "error" as const, message: err }, ...prev].slice(0, 8));
        throw new Error(err);
      }

      const okMsg = "Verificación reutilizada correctamente.";
      setEvents((prev) => [{ verificationId: value, at: new Date().toISOString(), status: "ok" as const, message: okMsg }, ...prev].slice(0, 8));
      setMessage(okMsg);
    } catch (e: any) {
      setMessage(e?.message || "No se pudo reutilizar la verificación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Reutilización de verificaciones</h1>
        <p className="mt-2 text-sm text-slate-600">
          Reutiliza verificaciones ya resueltas para acelerar nuevas evaluaciones y mantener trazabilidad en tus procesos.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-slate-900">ID de verificación</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            value={verificationId}
            onChange={(e) => setVerificationId(e.target.value)}
            placeholder="Ejemplo: 8f3c..."
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submitReuse}
              disabled={busy}
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {busy ? "Procesando…" : "Reutilizar verificación"}
            </button>
            <Link
              href="/company/requests"
              className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Ir a solicitudes
            </Link>
          </div>

          {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Cómo usar esta pantalla</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Copia el ID de una verificación ya validada.</li>
            <li>2. Lanza la reutilización para tu proceso actual.</li>
            <li>3. Revisa el detalle y la trazabilidad desde solicitudes.</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Si no localizas el ID, usa la tabla de <Link href="/company/requests" className="underline underline-offset-2">solicitudes</Link> para abrir el detalle.
          </p>
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Actividad reciente de reutilización</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Todavía no hay actividad en esta sesión. Cada intento quedará registrado aquí para seguimiento operativo.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {events.map((event) => (
              <li key={`${event.at}-${event.verificationId}`} className="rounded-xl border border-slate-200 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-700">{event.verificationId}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${event.status === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {event.status === "ok" ? "Correcto" : "Error"}
                  </span>
                </div>
                <p className="mt-1 text-slate-700">{event.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
