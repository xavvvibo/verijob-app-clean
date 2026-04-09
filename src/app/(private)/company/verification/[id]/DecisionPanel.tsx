"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCompanyVerificationStatus } from "../../actions";

export default function DecisionPanel(props: {
  verificationRequestId: string;
  currentStatus: string;
}) {
  const { verificationRequestId, currentStatus } = props;

  const router = useRouter();
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled =
    isPending || status === "verified" || status === "rejected";
  const isResolved = status === "verified" || status === "rejected";

  function act(nextStatus: "verified" | "rejected") {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await setCompanyVerificationStatus({
          verificationRequestId,
          nextStatus,
          note: note.trim() || undefined,
        });
        setStatus(nextStatus);
        setSuccess(result?.message || (nextStatus === "verified" ? "Experiencia confirmada." : "Experiencia rechazada."));
        setNote("");
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "No se pudo registrar la decisión. Inténtalo de nuevo.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{isResolved ? "Solicitud resuelta" : "Toma una decisión"}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {isResolved
              ? "Esta solicitud ya está resuelta y el candidato verá el resultado registrado."
              : "Confirma o rechaza esta experiencia. Tu decisión quedará registrada para el candidato."}
          </p>
        </div>
        <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
          Estado actual: <span className="font-semibold capitalize text-slate-900">{status.replaceAll("_", " ")}</span>
        </div>
      </div>

      {isResolved ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${status === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          Esta solicitud ya está resuelta.
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Decide solo si puedes confirmar con seguridad que esta experiencia ocurrió.
        </div>
      )}

      {!isResolved ? (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-medium text-slate-600">Nota interna (opcional)</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none ring-blue-500/50 placeholder:text-slate-400 focus:ring-2"
            placeholder="Ej: Confirmado por RRHH / No consta en nuestros registros / Falta contexto..."
            disabled={disabled}
          />
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => act("verified")}
          disabled={disabled}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "verified" ? "Experiencia confirmada" : "Confirmar experiencia"}
        </button>

        <button
          onClick={() => act("rejected")}
          disabled={disabled}
          className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "rejected" ? "Experiencia rechazada" : "Rechazar experiencia"}
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {isResolved
          ? "No necesitas hacer nada más salvo que se abra un caso nuevo."
          : "Tu decisión quedará registrada para el candidato y para tu equipo."}
      </p>
    </section>
  );
}
