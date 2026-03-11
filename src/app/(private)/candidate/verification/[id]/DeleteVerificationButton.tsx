"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildVerificationRevokeRequest,
  getVerificationRevokeEndpoint,
  getVerificationRevokeErrorMessage,
} from "@/lib/candidate/verification-revoke";

export default function DeleteVerificationButton({ verificationId }: { verificationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onDelete() {
    const ok = window.confirm(
      "¿Seguro que quieres borrar esta verificación?\n\nSe revocará la solicitud y se actualizarán tus métricas de perfil."
    );
    if (!ok) return;
    setLoading(true);
    setMessage(null);
    try {
      const requestInit = buildVerificationRevokeRequest(
        "Eliminada por el candidato desde su panel"
      ) as RequestInit;
      const res = await fetch(
        getVerificationRevokeEndpoint(verificationId),
        requestInit
      );
      const data = await res.json().catch(() => ({}));
      const errorMessage = getVerificationRevokeErrorMessage({
        responseOk: res.ok,
        payload: data,
        fallback: "No se pudo eliminar la verificación.",
      });
      if (errorMessage) throw new Error(errorMessage);
      setMessage("Verificación eliminada correctamente.");
      setTimeout(() => {
        router.replace("/candidate/verifications");
        router.refresh();
      }, 500);
    } catch (e: any) {
      setMessage(e?.message || "No se pudo eliminar la verificación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={loading}
        className="inline-flex rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
      >
        {loading ? "Eliminando..." : "Borrar verificación"}
      </button>
      {message ? <p className="text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}
