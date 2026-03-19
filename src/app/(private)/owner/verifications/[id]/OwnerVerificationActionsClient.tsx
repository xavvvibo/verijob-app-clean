"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Decision = "review" | "approve" | "reject";

export default function OwnerVerificationActionsClient({
  verificationId,
  currentStatus,
}: {
  verificationId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>("review");
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectedReason, setRejectedReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/internal/owner/verifications/${encodeURIComponent(verificationId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          review_notes: reviewNotes,
          rejected_reason: decision === "reject" ? rejectedReason : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.details || data?.error || "No se pudo actualizar la verificación.");
      setNotice(
        decision === "approve"
          ? "Verificación aprobada manualmente."
          : decision === "reject"
            ? "Verificación rechazada manualmente."
            : "Verificación marcada en revisión manual."
      );
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la verificación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Operar verificación</h2>
          <p className="mt-1 text-sm text-slate-600">
            Estado actual: <span className="font-semibold text-slate-900">{currentStatus || "Sin estado"}</span>.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDecision("review")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${decision === "review" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 bg-white text-slate-700"}`}
        >
          En revisión
        </button>
        <button
          type="button"
          onClick={() => setDecision("approve")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${decision === "approve" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"}`}
        >
          Aprobar
        </button>
        <button
          type="button"
          onClick={() => setDecision("reject")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${decision === "reject" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-300 bg-white text-slate-700"}`}
        >
          Rechazar
        </button>
      </div>

      <textarea
        value={reviewNotes}
        onChange={(event) => setReviewNotes(event.target.value)}
        rows={3}
        placeholder="Notas internas de revisión"
        className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
      />

      {decision === "reject" ? (
        <textarea
          value={rejectedReason}
          onChange={(event) => setRejectedReason(event.target.value)}
          rows={2}
          placeholder="Motivo visible para el rechazo"
          className="mt-3 w-full rounded-xl border border-rose-300 px-3 py-2 text-sm text-slate-900"
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || (decision === "reject" && !rejectedReason.trim())}
          className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {loading ? "Guardando…" : decision === "approve" ? "Confirmar aprobación" : decision === "reject" ? "Confirmar rechazo" : "Marcar en revisión"}
        </button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      </div>
    </section>
  );
}
