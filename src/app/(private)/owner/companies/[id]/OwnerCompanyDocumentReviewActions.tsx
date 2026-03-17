"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InlineStatusMessage from "@/components/ui/InlineStatusMessage";

export default function OwnerCompanyDocumentReviewActions({
  documentId,
  currentStatus,
}: {
  documentId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectedReason, setRejectedReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);

  const current = String(currentStatus || "").toLowerCase();
  const isOverride = current === "approved" || current === "rejected";

  async function submit() {
    setMessage(null);
    if (decision === "reject" && !rejectedReason.trim()) {
      setMessage({ tone: "error", text: "El rechazo manual requiere motivo." });
      return;
    }
    if (isOverride && !reviewNotes.trim()) {
      setMessage({ tone: "error", text: "Si cambias una decisión previa, deja una nota interna." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/internal/owner/company-documents/${encodeURIComponent(documentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          review_notes: reviewNotes.trim() || null,
          rejected_reason: decision === "reject" ? rejectedReason.trim() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = String(data?.details || data?.error || "No se pudo guardar la revisión manual.");
        setMessage({ tone: "error", text: details });
        return;
      }
      setMessage({
        tone: "success",
        text: decision === "approve" ? "Documento aprobado manualmente." : "Documento rechazado manualmente.",
      });
      router.refresh();
    } catch (error: any) {
      setMessage({ tone: "error", text: String(error?.message || "No se pudo guardar la revisión manual.") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revisión owner</span>
        {isOverride ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">Override manual</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
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
        onChange={(e) => setReviewNotes(e.target.value)}
        placeholder={isOverride ? "Nota interna obligatoria para cambiar una decisión previa" : "Nota interna opcional para owner"}
        className="mt-3 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {decision === "reject" ? (
        <input
          value={rejectedReason}
          onChange={(e) => setRejectedReason(e.target.value)}
          placeholder="Motivo de rechazo visible en trazabilidad"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Guardando…" : decision === "approve" ? "Confirmar aprobación" : "Confirmar rechazo"}
        </button>
      </div>
      {message ? <div className="mt-3"><InlineStatusMessage tone={message.tone} message={message.text} /></div> : null}
    </div>
  );
}
