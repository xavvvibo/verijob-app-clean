"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildVerificationRevokeRequest,
  getVerificationRevokeEndpoint,
  getVerificationRevokeErrorMessage,
} from "@/lib/candidate/verification-revoke";

export default function DeleteVerificationInlineButton({ verificationId }: { verificationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    const ok = window.confirm("¿Seguro que quieres borrar esta verificación?");
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
