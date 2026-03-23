"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildVerificationRevokeRequest,
  buildVerificationRemovalWarningMessage,
  getVerificationRevokeEndpoint,
  getVerificationRevokeErrorMessage,
  getVerificationRevokePreviewEndpoint,
} from "@/lib/candidate/verification-revoke";

export default function DeleteVerificationButton({ verificationId }: { verificationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onDelete() {
    let previewPayload: any = null;
    try {
      const previewRes = await fetch(getVerificationRevokePreviewEndpoint(verificationId), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      previewPayload = await previewRes.json().catch(() => ({}));
      if (!previewRes.ok) {
        throw new Error(
          getVerificationRevokeErrorMessage({
            responseOk: false,
            payload: previewPayload,
            fallback: "No se pudo preparar la eliminación de la verificación.",
          }) || "No se pudo preparar la eliminación de la verificación.",
        );
      }
    } catch (e: any) {
      setMessage(e?.message || "No se pudo preparar la eliminación de la verificación.");
      return;
    }

    const ok = window.confirm(
      buildVerificationRemovalWarningMessage(previewPayload?.affected_experiences),
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
      const affectedCount = Array.isArray(data?.affected_experiences) ? data.affected_experiences.length : 0;
      setMessage(
        affectedCount > 0
          ? `Verificación eliminada correctamente. ${affectedCount} experiencia(s) han perdido esta verificación.`
          : "Verificación eliminada correctamente.",
      );
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
