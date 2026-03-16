export function isMissingExternalResolvedColumn(error: any) {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return message.includes("external_resolved") || details.includes("external_resolved");
}

export function isVerificationExternallyResolved(row: any) {
  if (!row) return false;
  if (typeof row?.external_resolved === "boolean") return row.external_resolved;
  const status = String(row?.status || "").toLowerCase();
  if (status === "verified" || status === "rejected" || status === "revoked") return true;
  return Boolean(row?.resolved_at);
}
