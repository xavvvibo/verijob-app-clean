export function normalizeCompanyTaxId(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-./]+/g, "");
}

export async function findCompanyByNormalizedTaxId(admin: any, rawTaxId: unknown) {
  const normalizedTaxId = normalizeCompanyTaxId(rawTaxId);
  if (!normalizedTaxId) {
    return {
      normalizedTaxId,
      company: null,
    };
  }

  const { data, error } = await admin
    .from("company_profiles")
    .select("company_id,legal_name,trade_name,tax_id")
    .not("tax_id", "is", null)
    .limit(5000);

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const company =
    rows.find((row: any) => normalizeCompanyTaxId(row?.tax_id) === normalizedTaxId) || null;

  return {
    normalizedTaxId,
    company: company
      ? {
          company_id: String(company.company_id),
          legal_name: String(company.legal_name || "").trim() || null,
          trade_name: String(company.trade_name || "").trim() || null,
          tax_id: String(company.tax_id || "").trim() || null,
        }
      : null,
  };
}
