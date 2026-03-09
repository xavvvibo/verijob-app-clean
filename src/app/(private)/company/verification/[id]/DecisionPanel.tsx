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
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>
        Decisión
      </h2>
      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Al aprobar o rechazar, se actualiza la solicitud de verificación de esta experiencia laboral y se registra la trazabilidad.
      </p>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
          Nota (opcional)
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
          }}
          placeholder="Ej: Evidencia válida / Faltan documentos / Fechas inconsistentes..."
          disabled={disabled}
        />
      </div>

      {error ? (
        <div style={{ marginTop: 10, opacity: 0.95 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          onClick={() => act("verified")}
          disabled={disabled}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          Aprobar
        </button>

        <button
          onClick={() => act("rejected")}
          disabled={disabled}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          Rechazar
        </button>

        <div
          style={{
            marginLeft: "auto",
            fontSize: 12,
            opacity: 0.75,
            alignSelf: "center",
          }}
        >
          Estado:{" "}
          <span style={{ fontWeight: 700, opacity: 1 }}>
            {currentStatus}
          </span>
        </div>
      </div>
    </div>
  );
}
