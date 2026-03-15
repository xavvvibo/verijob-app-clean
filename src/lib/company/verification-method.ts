const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "live.com",
  "msn.com",
  "aol.com",
]);

export type CompanyVerificationMethod = "domain" | "documents" | "both" | "none";

function normalizeHost(raw: unknown): string | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  try {
    const url = value.startsWith("http://") || value.startsWith("https://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function emailDomain(raw: unknown): string | null {
  const email = String(raw || "").trim().toLowerCase();
  if (!email.includes("@")) return null;
  const domain = email.split("@")[1]?.trim().replace(/^www\./, "") || "";
  return domain || null;
}

function isCorporateDomain(domain: string | null) {
  return Boolean(domain && !PUBLIC_EMAIL_DOMAINS.has(domain));
}

export function deriveCompanyVerificationMethod(input: {
  contactEmail?: unknown;
  websiteUrl?: unknown;
  hasApprovedDocuments?: boolean;
}) {
  const contactDomain = emailDomain(input.contactEmail);
  const websiteDomain = normalizeHost(input.websiteUrl);
  const hasDomainVerification = Boolean(contactDomain && websiteDomain && contactDomain === websiteDomain && isCorporateDomain(contactDomain));
  const hasDocumentsVerification = Boolean(input.hasApprovedDocuments);

  const method: CompanyVerificationMethod =
    hasDomainVerification && hasDocumentsVerification
      ? "both"
      : hasDomainVerification
        ? "domain"
        : hasDocumentsVerification
          ? "documents"
          : "none";

  if (method === "both") {
    return {
      method,
      label: "Señales por dominio y documentación",
      detail: contactDomain ? `Dominio corporativo detectado: ${contactDomain}` : "Hay señales por dominio corporativo y documentación aprobada",
      domain: contactDomain,
    };
  }
  if (method === "domain") {
    return {
      method,
      label: "Señal por dominio corporativo",
      detail: contactDomain ? `Dominio corporativo detectado: ${contactDomain}` : null,
      domain: contactDomain,
    };
  }
  if (method === "documents") {
    return {
      method,
      label: "Señal documental disponible",
      detail: "Existe al menos un documento aprobado en la ficha de empresa",
      domain: null,
    };
  }
  return {
    method,
    label: "Sin señal adicional confirmada",
    detail: "Todavía no hay señales de dominio corporativo o documentación aprobada",
    domain: null,
  };
}

export function companyVerificationMethodTone(method: CompanyVerificationMethod) {
  if (method === "both") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (method === "domain") return "border-teal-200 bg-teal-50 text-teal-800";
  if (method === "documents") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}
