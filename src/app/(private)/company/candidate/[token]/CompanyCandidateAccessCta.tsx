"use client";

import { useState } from "react";

export default function CompanyCandidateAccessCta({
  href,
  requestHref,
  availableAccesses,
  alreadyUnlocked = false,
  primaryLabel = "Acceder al perfil",
}: {
  href: string;
  requestHref: string;
  availableAccesses: number;
  alreadyUnlocked?: boolean;
  primaryLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmUnlock() {
    if (submitting) return;
    setError(null);

    if (availableAccesses <= 0) {
      setError("No tienes accesos disponibles para ver perfiles completos.");
      return;
    }

    setSubmitting(true);
    try {
      const targetUrl = new URL(requestHref, window.location.origin).toString();
      const response = await window.fetch(targetUrl, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 402) {
          setError("No tienes accesos disponibles para ver perfiles completos.");
          return;
        }
        if (response.status === 409) {
          if (payload?.access?.access_status === "active") {
            window.location.assign(href);
            return;
          }
          const details = String(payload?.user_message || payload?.details || "Este perfil todavía no está listo para desbloquearse.").trim();
          setError(details);
          return;
        }
        const details = String(payload?.user_message || payload?.details || payload?.error || "").trim();
        setError(details || "No se pudo abrir el perfil completo.");
        return;
      }

      const unlocked = payload?.unlocked === true;
      const fullView = payload?.view_mode === "full";
      if (!unlocked || !fullView) {
        setError("La API no confirmó el desbloqueo real del perfil.");
        return;
      }

      window.location.assign(href);
    } catch {
      setError("No se pudo abrir el perfil completo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadyUnlocked) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => window.location.assign(href)}
          className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
        >
          Ver perfil completo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
      >
        {primaryLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmación de acceso</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Acceder al perfil completo</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Acceder al perfil completo de este candidato consumirá 1 acceso. El perfil quedará desbloqueado
              permanentemente para tu empresa.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Accesos a perfiles disponibles: {availableAccesses}</p>
              {availableAccesses <= 0 ? (
                <p className="mt-1 text-rose-700">No tienes accesos disponibles para ver perfiles completos.</p>
              ) : null}
            </div>
            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConfirmUnlock}
                disabled={submitting}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {submitting ? "Procesando..." : "Acceder al perfil"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (submitting) return;
                  setOpen(false);
                  setError(null);
                }}
                className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
