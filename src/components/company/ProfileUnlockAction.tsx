"use client";

import { useState } from "react";

export default function ProfileUnlockAction({
  href,
  availableAccesses,
  alreadyUnlocked = false,
  primaryLabel = "Acceder al perfil",
}: {
  href: string;
  availableAccesses: number;
  alreadyUnlocked?: boolean;
  primaryLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  if (alreadyUnlocked) {
    return (
      <a
        href={href}
        className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
      >
        Ver perfil completo
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={href}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                Acceder al perfil
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
