"use client";

import { useState, useTransition } from "react";
import { setCompanyVerificationStatus } from "../../actions";

export default function DecisionPanel(props: {
  verificationRequestId: string;
  currentStatus: string;
}) {
  const { verificationRequestId, currentStatus } = props;

  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled =
    isPending || currentStatus === "verified" || currentStatus === "rejected";

  function act(nextStatus: "verified" | "rejected") {
    setError(null);
    startTransition(async () => {
      try {
        await setCompanyVerificationStatus({
          verificationRequestId,
          nextStatus,
          note: note.trim() || undefined,
        });
        setNote("");
      } catch (e: any) {
        setError(e?.message ?? "Error");
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Resolver verificación</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Confirma o rechaza esta experiencia laboral. La resolución quedará registrada con trazabilidad.
          </p>
        </div>
        <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
          Estado actual: <span className="font-semibold text-slate-900">{currentStatus}</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-xs font-medium text-slate-600">Nota interna (opcional)</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none ring-blue-500/50 placeholder:text-slate-400 focus:ring-2"
          placeholder="Ej: Evidencia válida / Faltan documentos / Fechas inconsistentes..."
          disabled={disabled}
        />
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error || "No se pudo registrar la decisión."}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => act("verified")}
          disabled={disabled}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Confirmar experiencia
        </button>

        <button
          onClick={() => act("rejected")}
          disabled={disabled}
          className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Rechazar experiencia
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Verificar experiencias recibidas es gratuito para empresas.
      </p>
    </section>
  );
}
