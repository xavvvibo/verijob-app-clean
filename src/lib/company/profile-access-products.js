/**
 * @typedef {"company_single_cv" | "company_pack_5"} CompanyProfileAccessProductKey
 */

/**
 * @param {unknown} raw
 * @returns {CompanyProfileAccessProductKey | null}
 */
export function normalizeCompanyProfileAccessProductKey(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "company_single_profile" || value === "company_single_cv" || value === "company_single") {
    return "company_single_cv";
  }
  if (value === "company_pack5_profiles" || value === "company_pack_5" || value === "company_pack_5_profiles") {
    return "company_pack_5";
  }
  return null;
}

/**
 * @param {unknown} raw
 * @returns {number}
 */
export function resolveCompanyProfileAccessCreditsGranted(raw) {
  const key = normalizeCompanyProfileAccessProductKey(raw);
  if (key === "company_single_cv") return 1;
  if (key === "company_pack_5") return 5;
  return 0;
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function resolveCompanyProfileAccessProductLabel(raw) {
  const key = normalizeCompanyProfileAccessProductKey(raw);
  if (key === "company_single_cv") return "1 acceso";
  if (key === "company_pack_5") return "Pack de 5 accesos";
  return "Accesos";
}
