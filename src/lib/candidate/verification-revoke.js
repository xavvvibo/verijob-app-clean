export function getVerificationRevokeEndpoint(verificationId) {
  return `/api/verification/${encodeURIComponent(String(verificationId || ""))}/revoke`;
}

export function getVerificationRevokePreviewEndpoint(verificationId) {
  return `${getVerificationRevokeEndpoint(verificationId)}?preview=1`;
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

export function buildVerificationRemovalWarningMessage(affectedExperiences) {
  const affected = Array.isArray(affectedExperiences) ? affectedExperiences : [];
  if (affected.length === 0) {
    return "¿Seguro que quieres borrar esta verificación?\n\nSe revocará la solicitud y se actualizarán tus métricas de perfil.";
  }

  const listed = affected
    .slice(0, 8)
    .map((item) => `- ${String(item?.label || "Experiencia vinculada").trim()}`)
    .join("\n");
  const extraCount = Math.max(0, affected.length - 8);

  return [
    "Al eliminar esta verificación, también se retirará la verificación de las siguientes experiencias:",
    listed,
    extraCount > 0 ? `- y ${extraCount} experiencia(s) más` : "",
    "",
    "Las experiencias seguirán existiendo, pero dejarán de figurar como verificadas.",
    "¿Confirmas que quieres continuar?",
  ]
    .filter(Boolean)
    .join("\n");
}
