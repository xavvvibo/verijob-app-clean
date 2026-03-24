export type TrustBreakdownDisplay = {
  documentary: number;
  company: number;
  peer: number;
  reuse: number;
  cvConsistency: number;
};

export type TrustBreakdownMeta = {
  model: string | null;
  updated_at: string | null;
  experience_total: number | null;
  weights: Record<string, number>;
  raw: Record<string, any>;
};

export type NormalizedTrustBreakdown = {
  display: TrustBreakdownDisplay;
  meta: TrustBreakdownMeta;
  legacy: {
    verification: number;
    evidence: number;
    consistency: number;
    reuse: number;
    approved: number;
    confirmed: number;
    evidences: number;
    reuseEvents: number;
    reuseCompanies: number;
  };
};

const DEFAULT_BREAKDOWN: TrustBreakdownDisplay = {
  documentary: 0,
  company: 0,
  peer: 0,
  reuse: 0,
  cvConsistency: 0,
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampPercent(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(toFiniteNumber(value, 0))));
}

function toObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function pickNumber(source: Record<string, any>, keys: string[], fallback = 0) {
  for (const key of keys) {
    if (source[key] != null) return toFiniteNumber(source[key], fallback);
  }
  return fallback;
}

function normalizeWeights(source: Record<string, any>) {
  const weights = toObject(source.weights);
  return {
    documentary: pickNumber(weights, ["documentary", "documental", "evidence", "documentary_total"], 0),
    company: pickNumber(weights, ["company", "empresa", "business", "company_verification"], 0),
    peer: pickNumber(weights, ["peer", "pares"], 0),
    reuse: pickNumber(weights, ["reuse", "reutilizacion", "reutilización"], 0),
    cvConsistency: pickNumber(weights, ["cv_consistency", "consistency", "consistencia_cv"], 0),
  };
}

export function normalizeTrustBreakdown(rawValue: unknown): NormalizedTrustBreakdown {
  const raw = toObject(rawValue);
  const experienceTotal = raw.experience_total != null ? toFiniteNumber(raw.experience_total, 0) : null;
  const normalizedDisplay = {
    documentary: clampPercent(pickNumber(raw, ["documentary", "documental", "evidence", "evidence_total"])),
    company: clampPercent(pickNumber(raw, ["company", "empresa", "verification", "company_total"])),
    peer: clampPercent(pickNumber(raw, ["peer", "peer_total"])),
    reuse: clampPercent(pickNumber(raw, ["reuse", "reuse_total"])),
    cvConsistency: clampPercent(pickNumber(raw, ["cv_consistency", "consistency", "consistencia_cv"])),
  };

  const legacyVerification = clampPercent(
    normalizedDisplay.company + normalizedDisplay.peer || pickNumber(raw, ["verification"])
  );
  const legacyEvidence = clampPercent(
    normalizedDisplay.documentary || pickNumber(raw, ["evidence", "documentary", "documental"])
  );
  const legacyConsistency = clampPercent(
    normalizedDisplay.cvConsistency || pickNumber(raw, ["consistency", "cv_consistency"])
  );
  const legacyReuse = clampPercent(normalizedDisplay.reuse || pickNumber(raw, ["reuse", "reuse_total"]));

  return {
    display: normalizedDisplay,
    meta: {
      model: raw.model != null ? String(raw.model) : null,
      updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
      experience_total: experienceTotal,
      weights: normalizeWeights(raw),
      raw,
    },
    legacy: {
      verification: legacyVerification,
      evidence: legacyEvidence,
      consistency: legacyConsistency,
      reuse: legacyReuse,
      approved: toFiniteNumber(raw.approved, 0),
      confirmed: toFiniteNumber(raw.confirmed, 0),
      evidences: toFiniteNumber(raw.evidences, 0),
      reuseEvents: toFiniteNumber(raw.reuseEvents ?? raw.reuse_events ?? raw.reuse_total, 0),
      reuseCompanies: toFiniteNumber(raw.reuseCompanies ?? raw.reuse_companies, 0),
    },
  };
}

export function getTrustBreakdownDisplayEntries(rawValue: unknown) {
  const normalized = normalizeTrustBreakdown(rawValue);
  return [
    { key: "documentary", label: "Documental", value: normalized.display.documentary },
    { key: "company", label: "Empresa", value: normalized.display.company },
    { key: "peer", label: "Peer", value: normalized.display.peer },
    { key: "reuse", label: "Reuse", value: normalized.display.reuse },
    { key: "cvConsistency", label: "Consistencia CV", value: normalized.display.cvConsistency },
  ] as const;
}

export function getTrustVerificationLabel(input: unknown) {
  const value = String(input || "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("vida_laboral") || value.includes("social_security")) return "Vida laboral";
  if (value.includes("contrato")) return "Contrato";
  if (value.includes("nomina") || value.includes("payroll")) return "Nómina";
  if (value.includes("certificado_empresa") || value.includes("certificate")) return "Certificado de empresa";
  if (value.includes("peer")) return "Peer";
  if (value.includes("company") || value.includes("empresa") || value.includes("email")) return "Verificación empresa";
  if (value.includes("documentary")) return "Documental";
  return null;
}

export function getTrustBreakdownLegacyCompat(rawValue: unknown) {
  return normalizeTrustBreakdown(rawValue).legacy;
}

export const EMPTY_TRUST_BREAKDOWN = DEFAULT_BREAKDOWN;
