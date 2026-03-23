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

export default function DeleteVerificationInlineButton({ verificationId }: { verificationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    const previewRes = await fetch(getVerificationRevokePreviewEndpoint(verificationId), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const previewJson = await previewRes.json().catch(() => ({}));
    const previewError = getVerificationRevokeErrorMessage({
      responseOk: previewRes.ok,
      payload: previewJson,
      fallback: "No se pudo preparar la eliminación.",
    });
    if (previewError) {
      window.alert(previewError);
      return;
    }

    const ok = window.confirm(
      buildVerificationRemovalWarningMessage(previewJson?.affected_experiences),
    );
    if (!ok) return;
    setLoading(true);
    try {
      const requestInit = buildVerificationRevokeRequest(
        "Eliminada por el candidato desde listado"
      ) as RequestInit;
      const res = await fetch(
        getVerificationRevokeEndpoint(verificationId),
        requestInit
      );
      const json = await res.json().catch(() => ({}));
      const errorMessage = getVerificationRevokeErrorMessage({
        responseOk: res.ok,
        payload: json,
        fallback: "No se pudo eliminar.",
      });
      if (errorMessage) throw new Error(errorMessage);
      if (Array.isArray(json?.affected_experiences) && json.affected_experiences.length > 0) {
        window.alert(
          `${json.affected_experiences.length} experiencia(s) han dejado de figurar como verificadas tras eliminar esta verificación.`,
        );
      }
      router.refresh();
    } catch (e: any) {
      window.alert(e?.message || "No se pudo eliminar la verificación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onDelete()}
      disabled={loading}
      className="text-rose-700 hover:underline disabled:opacity-60"
    >
      {loading ? "Eliminando..." : "Borrar"}
    </button>
  );
}
