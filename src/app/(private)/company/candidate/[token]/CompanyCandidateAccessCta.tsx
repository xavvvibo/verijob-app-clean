"use client";

import { useEffect, useState } from "react";

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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [confirmState, setConfirmState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastRequestUrl, setLastRequestUrl] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    console.log("[company-candidate-cta] mounted", { href, requestHref, availableAccesses, alreadyUnlocked });
  }, [href, requestHref, availableAccesses, alreadyUnlocked]);

  async function handleConfirmUnlock() {
    if (submitting) return;
    setError(null);
    setLastError(null);
    setLastStatus(null);
    setConfirmState("running");

    if (availableAccesses <= 0) {
      setError("No tienes accesos disponibles para ver perfiles completos.");
      setLastError("no_available_accesses");
      setConfirmState("error");
      return;
    }

    setSubmitting(true);
    try {
      const targetUrl = new URL(requestHref, window.location.origin).toString();
      setLastRequestUrl(targetUrl);
      console.log("[company-candidate-cta] confirm:start", {
        href,
        requestHref,
        targetUrl,
        availableAccesses,
        alreadyUnlocked,
      });

      const response = await window.fetch(targetUrl, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      const statusLabel = `${response.status} ${response.ok ? "ok" : "error"}`;
      setLastStatus(statusLabel);
      console.log("[company-candidate-cta] confirm:response", { status: response.status, ok: response.ok, payload });

      if (!response.ok) {
        if (response.status === 402) {
          setError("No tienes accesos disponibles para ver perfiles completos.");
          setLastError("402 no_available_accesses");
          setConfirmState("error");
          return;
        }
        if (response.status === 409) {
          setConfirmState("success");
          window.location.assign(href);
          return;
        }
        const details = String(payload?.user_message || payload?.details || payload?.error || "").trim();
        const message = details || "No se pudo abrir el perfil completo.";
        setError(message);
        setLastError(message);
        setConfirmState("error");
        return;
      }

      const unlocked = payload?.unlocked === true;
      const fullView = payload?.view_mode === "full";
      if (!unlocked || !fullView) {
        const contractError = String(payload?.error || payload?.details || "unlock_contract_invalid");
        setError("La API no confirmó el desbloqueo real del perfil.");
        setLastError(contractError);
        setConfirmState("error");
        return;
      }

      setConfirmState("success");
      window.location.assign(href);
    } catch (clientError: any) {
      const message = String(clientError?.message || clientError || "client_error");
      console.error("[company-candidate-cta] confirm:client_error", clientError);
      setError("No se pudo abrir el perfil completo.");
      setLastError(message);
      setConfirmState("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadyUnlocked) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            console.log("[company-candidate-cta] open-full-direct", { href });
            window.location.assign(href);
          }}
          className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
        >
          Ver perfil completo
        </button>
        <p className="text-[11px] text-slate-500">CTA debug: mounted={mounted ? "yes" : "no"} · unlocked=yes</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          console.log("[company-candidate-cta] primary-click", { href, requestHref });
          setClickCount((value) => value + 1);
          setError(null);
          setLastError(null);
          setLastStatus(null);
          setConfirmState("idle");
          setOpen(true);
        }}
        className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
      >
        {primaryLabel}
      </button>

      <p className="text-[11px] text-slate-500">
        CTA debug: mounted={mounted ? "yes" : "no"} · modal={open ? "open" : "closed"} · clicks={clickCount}
      </p>

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
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p>confirm={confirmState}</p>
              <p>lastStatus={lastStatus || "—"}</p>
              <p>lastError={lastError || "—"}</p>
              <p className="break-all">request={lastRequestUrl || "—"}</p>
            </div>
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
                  console.log("[company-candidate-cta] cancel");
                  setOpen(false);
                  setError(null);
                  setConfirmState("idle");
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
