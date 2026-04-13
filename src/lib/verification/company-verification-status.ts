export const COMPANY_VERIFICATION_SNAPSHOT_STATUSES = new Set([
  "unverified",
  "unverified_external",
  "registered_in_verijob",
  "verified_paid",
  "verified_document",
]);

export function normalizeCompanyVerificationStatusSnapshot(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return "unverified";
  if (COMPANY_VERIFICATION_SNAPSHOT_STATUSES.has(status)) return status;
  return "unverified";
}

export function candidateFacingCompanyVerificationLabel(statusRaw: unknown) {
  const status = normalizeCompanyVerificationStatusSnapshot(statusRaw);
  if (status === "registered_in_verijob") return "Empresa registrada";
  if (status === "verified_paid") return "Empresa con plan activo";
  if (status === "verified_document") return "Empresa verificada documentalmente";
  if (status === "unverified_external") return "Dominio corporativo coincidente";
  return "Sin validación empresarial adicional";
}
