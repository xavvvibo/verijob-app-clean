"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export const COMPANY_PROFILE_UNLOCKED_EVENT = "company:profile-unlocked";

export default function ProfileUnlockAction({
  candidateToken,
  href,
  requestHref,
  availableAccesses,
  alreadyUnlocked = false,
  unlockedAt = null,
  unlockedUntil = null,
  primaryLabel = "Ver perfil completo (-1 acceso)",
  upgradeHref,
}: {
  candidateToken?: string;
  href: string;
  requestHref?: string;
  availableAccesses: number;
  alreadyUnlocked?: boolean;
  unlockedAt?: string | null;
  unlockedUntil?: string | null;
  primaryLabel?: string;
  upgradeHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(alreadyUnlocked);
  const [remainingAccesses, setRemainingAccesses] = useState(Number(availableAccesses || 0));
  const [accessUnlockedUntil, setAccessUnlockedUntil] = useState<string | null>(unlockedUntil);

  function formatDate(value: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
  }

  const unlockRequestHref =
    requestHref ||
    href.replace("/company/candidate/", "/api/company/candidate/").replace(/\?view=full$/, "/unlock");
  const unlockUntilLabel = formatDate(accessUnlockedUntil);

  if (isUnlocked) {
    return (
      <div className="space-y-3">
        <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          Acceso activo
        </div>
        <button
          type="button"
          onClick={() => router.push(href)}
          className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
        >
          Abrir perfil completo
        </button>
        <p className="text-xs text-emerald-700">
          {unlockUntilLabel ? `Ya está desbloqueado para tu empresa hasta ${unlockUntilLabel}.` : "Ya está desbloqueado para tu empresa dentro de la ventana activa."}
        </p>
      </div>
    );
  }

  async function handleConfirmUnlock() {
    if (submitting) return;
    setError(null);
    if (remainingAccesses <= 0) {
      setError("No tienes accesos disponibles para abrir perfiles completos.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(unlockRequestHref, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 402) {
          setError("No tienes accesos disponibles para abrir perfiles completos.");
          return;
        }
        const details = String(payload?.user_message || payload?.details || payload?.error || "").trim();
        setError(details || "No se pudo abrir el perfil completo.");
        return;
      }

      const nextUnlockedAt = String(payload?.unlocked_at || "").trim() || new Date().toISOString();
      const nextUnlockedUntil = String(payload?.unlocked_until || "").trim() || null;
      const nextRemainingAccesses = Number(payload?.remaining_accesses || 0);
      setIsUnlocked(true);
      setAccessUnlockedUntil(nextUnlockedUntil);
      setRemainingAccesses(nextRemainingAccesses);
      setOpen(false);
      window.dispatchEvent(
        new CustomEvent(COMPANY_PROFILE_UNLOCKED_EVENT, {
          detail: {
            candidateToken: candidateToken || null,
            consumed: payload?.consumed === true,
            remaining_accesses: nextRemainingAccesses,
            unlocked_at: nextUnlockedAt,
            unlocked_until: nextUnlockedUntil,
            href,
          },
        }),
      );
      router.push(href);
    } catch {
      setError("No se pudo abrir el perfil completo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black"
      >
        {primaryLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acceso al perfil completo</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Ver perfil completo</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Verás la versión completa del candidato. El primer acceso consume 1 crédito y no volverá a consumirse mientras siga dentro de la ventana activa.
            </p>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Accesos disponibles para abrir perfiles: {remainingAccesses}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">La vista completa muestra más contexto profesional y evita decidir solo con el resumen público.</p>
              {remainingAccesses <= 0 ? (
                <p className="mt-1 text-rose-700">No tienes accesos disponibles para abrir perfiles completos.</p>
              ) : null}
            </div>
            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConfirmUnlock}
                disabled={submitting}
                className="inline-flex min-w-[220px] justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {submitting ? "Abriendo perfil…" : "Ver perfil completo"}
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
              {upgradeHref && remainingAccesses <= 0 ? (
                <a
                  href={upgradeHref}
                  className="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-100"
                >
                  Ver planes y accesos
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
