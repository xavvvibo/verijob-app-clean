"use client";

import { useState } from "react";

type ActionOption = {
  key: string;
  label: string;
  description: string;
};

const ACTIONS: ActionOption[] = [
  {
    key: "force_plan_change",
    label: "Forzar cambio de plan",
    description: "Preparado para soporte de monetización (registro trazable).",
  },
  {
    key: "extend_trial",
    label: "Extender trial",
    description: "Registrar extensión manual de trial con motivo.",
  },
  {
    key: "resend_magic_link",
    label: "Reenviar magic link",
    description: "Registrar solicitud de reenvío de acceso al usuario.",
  },
  {
    key: "flag_experience_manual_review",
    label: "Marcar experiencia para revisión manual",
    description: "Escalar revisión de experiencias del usuario.",
  },
  {
    key: "flag_evidence_manual_review",
    label: "Marcar evidencia para revisión manual",
    description: "Escalar revisión documental de evidencias.",
  },
  {
    key: "add_internal_note",
    label: "Añadir nota interna",
    description: "Registrar contexto operativo para soporte owner.",
  },
];

export default function OwnerUserActionsClient({ targetUserId }: { targetUserId: string }) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reasonByKey, setReasonByKey] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function runAction(action: ActionOption) {
    const reason = String(reasonByKey[action.key] || "").trim();
    const ok = window.confirm(`¿Confirmas la acción \"${action.label}\" sobre este usuario?`);
    if (!ok) return;

    setBusyKey(action.key);
    setMessage(null);
    setIsError(false);
    try {
      const res = await fetch(`/api/internal/owner/users/${encodeURIComponent(targetUserId)}/actions`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action_type: action.key,
          reason: reason || null,
          payload: {},
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "owner_action_failed");
      setMessage("Acción registrada correctamente. Queda trazabilidad para seguimiento owner.");
      setReasonByKey((prev) => ({ ...prev, [action.key]: "" }));
    } catch (e: any) {
      setIsError(true);
      setMessage(e?.message || "No se pudo registrar la acción owner.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Acciones owner</h2>
      <p className="mt-1 text-sm text-slate-600">
        Acciones sensibles con confirmación y motivo opcional. Quedan registradas para trazabilidad operativa.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {ACTIONS.map((action) => {
          const busy = busyKey === action.key;
          return (
            <div key={action.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-900">{action.label}</div>
              <div className="mt-1 text-xs text-slate-600">{action.description}</div>
              <textarea
                value={reasonByKey[action.key] || ""}
                onChange={(e) => setReasonByKey((prev) => ({ ...prev, [action.key]: e.target.value }))}
                placeholder="Motivo (recomendado)"
                className="mt-3 min-h-[72px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void runAction(action)}
                disabled={busy}
                className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Registrando..." : "Ejecutar acción"}
              </button>
            </div>
          );
        })}
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            isError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
