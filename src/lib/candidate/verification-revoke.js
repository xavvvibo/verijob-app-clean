export function getVerificationRevokeEndpoint(verificationId) {
  return `/api/verification/${encodeURIComponent(String(verificationId || ""))}/revoke`;
}

export function buildVerificationRevokeRequest(reason) {
  return {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: String(reason || "").trim() || null }),
  };
}

export function getVerificationRevokeErrorMessage({ responseOk, payload, fallback }) {
  if (responseOk) return null;
  return String(payload?.error || fallback || "No se pudo eliminar la verificación.");
}
