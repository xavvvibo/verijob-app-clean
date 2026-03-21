type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDomainFromEmail(email: unknown) {
  const raw = String(email || "").trim().toLowerCase();
  const at = raw.indexOf("@");
  if (at === -1) return "";
  return raw.slice(at + 1).trim();
}

function normalizeHost(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const url = raw.startsWith("http://") || raw.startsWith("https://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function companyNameTokens(value: unknown) {
  return normalizeText(value)
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x && !["sl", "s.l", "s.l.", "sa", "s.a", "s.a.", "ltd", "inc", "llc"].includes(x));
}

function hasTokenOverlap(a: unknown, b: unknown) {
  const aa = companyNameTokens(a);
  const bb = new Set(companyNameTokens(b));
  if (!aa.length || !bb.size) return false;
  return aa.some((token) => bb.has(token));
}

export type VerificationConfidenceResult = {
  level: ConfidenceLevel;
  score: number;
  trustScoreAwarded: number;
  ownerAttentionRequired: boolean;
  verifierEmailDomain: string | null;
  matchNote: string;
};

export function computeVerificationConfidence(input: {
  externalEmailTarget?: unknown;
  claimedCompanyName?: unknown;
  associatedCompanyName?: unknown;
  companyWebsiteUrl?: unknown;
  companyContactEmail?: unknown;
  companyId?: unknown;
}) : VerificationConfidenceResult {
  const emailDomain = normalizeDomainFromEmail(input.externalEmailTarget);
  const websiteHost = normalizeHost(input.companyWebsiteUrl);
  const contactDomain = normalizeDomainFromEmail(input.companyContactEmail);
  const claimedCompany = String(input.claimedCompanyName || "").trim();
  const associatedCompany = String(input.associatedCompanyName || "").trim();
  const hasCompanyId = Boolean(String(input.companyId || "").trim());

  const exactDomainMatch =
    Boolean(emailDomain) &&
    ((Boolean(contactDomain) && emailDomain === contactDomain) ||
      (Boolean(websiteHost) && emailDomain === websiteHost));

  const companyTextOverlap =
    hasTokenOverlap(claimedCompany, associatedCompany) ||
    hasTokenOverlap(claimedCompany, emailDomain) ||
    hasTokenOverlap(associatedCompany, emailDomain);

  if (exactDomainMatch && companyTextOverlap && hasCompanyId) {
    return {
      level: "high",
      score: 100,
      trustScoreAwarded: 40,
      ownerAttentionRequired: false,
      verifierEmailDomain: emailDomain || null,
      matchNote: "Exact domain match with associated company and strong company-name overlap.",
    };
  }

  if ((exactDomainMatch && hasCompanyId) || (hasCompanyId && companyTextOverlap)) {
    return {
      level: "medium",
      score: 60,
      trustScoreAwarded: 0,
      ownerAttentionRequired: true,
      verifierEmailDomain: emailDomain || null,
      matchNote: "Associated company found, but confidence is not high enough to award trust score.",
    };
  }

  if (emailDomain) {
    return {
      level: "low",
      score: 20,
      trustScoreAwarded: 0,
      ownerAttentionRequired: true,
      verifierEmailDomain: emailDomain || null,
      matchNote: "Verification recorded, but verifier-company match is weak. Documentary evidence recommended.",
    };
  }

  return {
    level: "unknown",
    score: 0,
    trustScoreAwarded: 0,
    ownerAttentionRequired: true,
    verifierEmailDomain: null,
    matchNote: "Unable to determine verifier confidence. Documentary evidence recommended.",
  };
}
