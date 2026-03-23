export const DOCUMENTARY_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    document_type: { type: ["string", "null"] },
    candidate_name: { type: ["string", "null"] },
    company_name: { type: ["string", "null"] },
    job_title: { type: ["string", "null"] },
    start_date: { type: ["string", "null"] },
    end_date: { type: ["string", "null"] },
    issue_date: { type: ["string", "null"] },
    confidence_score: { type: ["number", "null"], minimum: 0, maximum: 1 },
    extracted_signals: { type: "array", items: { type: "string" } },
    matching_reason: { type: ["string", "null"] },
    missing_fields: { type: "array", items: { type: "string" } },
    needs_manual_review: { type: "boolean" },
    tax_id: { type: ["string", "null"] },
    employer_identifier: { type: ["string", "null"] },
    payroll_month: { type: ["string", "null"] },
    contract_type: { type: ["string", "null"] },
  },
  required: [
    "document_type",
    "candidate_name",
    "company_name",
    "job_title",
    "start_date",
    "end_date",
    "issue_date",
    "confidence_score",
    "extracted_signals",
    "matching_reason",
    "missing_fields",
    "needs_manual_review",
    "tax_id",
    "employer_identifier",
    "payroll_month",
    "contract_type",
  ],
};

function normalizeText(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PERSON_PARTICLES = new Set(["de", "del", "la", "las", "los", "el", "y", "da", "do", "dos", "das", "della", "di"]);
const COMPANY_STOPWORDS = new Set([
  "sl",
  "s",
  "l",
  "sa",
  "slu",
  "slu",
  "sociedad",
  "limitada",
  "anonima",
  "grupo",
  "holding",
  "empresa",
  "compania",
  "compañia",
  "services",
  "service",
  "solutions",
  "solution",
]);
const VIDA_LABORAL_IGNORED_KEYWORDS = [
  "desempleo",
  "prestacion por desempleo",
  "prestación por desempleo",
  "subsidio",
  "vacaciones",
  "vacaciones retribuidas",
  "movimiento administrativo",
  "situacion asimilada",
  "situación asimilada",
  "inactividad",
  "incapacidad temporal",
  "it contingencias",
  "maternidad",
  "paternidad",
];
const VIDA_LABORAL_LEGAL_NOISE_KEYWORDS = [
  "a los efectos previstos",
  "ley organica",
  "ley orgánica",
  "fichero general de afiliacion",
  "fichero general de afiliación",
  "referencias electronicas",
  "referencias electrónicas",
  "sede electronica",
  "sede electrónica",
  "codigo cea",
  "código cea",
  "documento no sera valido",
  "documento no será válido",
  "seguridad social informa",
];
const VIDA_LABORAL_ADMIN_KEYWORDS = [
  "desempleo",
  "prestacion desempleo",
  "prestacion por desempleo",
  "prestación desempleo",
  "prestación por desempleo",
  "subsidio",
  "suspension",
  "suspensión",
  "vacaciones",
  "vacaciones retribuidas y no disfrutadas",
  "movimiento administrativo",
  "incapacidad",
  "incapacidad temporal",
  "maternidad",
  "paternidad",
  "situacion asimilada",
  "situación asimilada",
];
const VIDA_LABORAL_SELF_EMPLOYMENT_KEYWORDS = [
  "autonomo",
  "autónomo",
  "reta",
  "regimen especial trabajadores autonomos",
  "régimen especial trabajadores autónomos",
  "trabajador autonomo",
  "trabajador autónomo",
];
const VIDA_LABORAL_STOPWORDS = new Set([
  "fecha",
  "alta",
  "baja",
  "empresa",
  "situacion",
  "situación",
  "ccc",
  "codigo",
  "código",
  "cotizacion",
  "cotización",
  "regimen",
  "régimen",
  "tipo",
  "contrato",
  "grupo",
  "epigrafe",
  "epígrafe",
  "coeficiente",
  "jornada",
  "dias",
  "días",
  "provincia",
  "clave",
  "barcelona",
  "granada",
  "madrid",
  "valencia",
  "sevilla",
  "malaga",
  "málaga",
]);
const DATE_TOKEN_REGEX = /\b(?:\d{2}[./-]\d{2}[./-]\d{4}|\d{2}[./-]\d{4}|\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\d{4})\b/g;
const DATE_PAIR_SOURCE =
  "(?:\\d{2}[./-]\\d{2}[./-]\\d{4}|\\d{2}[./-]\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{4}-\\d{2}|\\d{4})\\s+(?:a\\s+)?(?:\\d{2}[./-]\\d{2}[./-]\\d{4}|\\d{2}[./-]\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{4}-\\d{2}|\\d{4})";
const VIDA_LABORAL_REGIMEN_REGEX =
  /\b(?:general|reta|autonomo|autónomo|regimen especial trabajadores autonomos|régimen especial trabajadores autónomos)\b/i;
const VIDA_LABORAL_MOVEMENT_START_REGEX = new RegExp(
  [
    DATE_PAIR_SOURCE,
    "\\bautonomo\\b",
    "\\bautónomo\\b",
    "\\breta\\b",
    "\\bprestacion\\b",
    "\\bprestación\\b",
    "\\bsubsidio\\b",
    "\\bextincion\\b",
    "\\bextinción\\b",
    "\\bsuspension\\b",
    "\\bsuspensión\\b",
    "\\bvacaciones retribuidas\\b",
    "\\bincapacidad\\b",
    "\\bmaternidad\\b",
    "\\bpaternidad\\b",
  ].join("|"),
  "i",
);

function compactIdentity(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .trim();
}

function normalizeCompanyTokenText(v) {
  return normalizeText(v)
    .replace(/\b(s l|s a|s l u)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textTokens(v) {
  return normalizeText(v)
    .split(" ")
    .filter((x) => x.length > 2);
}

function companyTokens(v) {
  return normalizeCompanyTokenText(v)
    .split(" ")
    .filter((x) => x.length > 1 && !COMPANY_STOPWORDS.has(x));
}

function personTokens(v) {
  return normalizeText(v)
    .split(" ")
    .filter((x) => x.length > 1 && !PERSON_PARTICLES.has(x));
}

function tokenSimilarity(a, b) {
  const aSet = new Set(textTokens(a));
  const bSet = new Set(textTokens(b));
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  return intersection / Math.max(aSet.size, bSet.size);
}

function companySimilarity(a, b) {
  const aSet = new Set(companyTokens(a));
  const bSet = new Set(companyTokens(b));
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const base = intersection / Math.max(aSet.size, bSet.size);
  const subset =
    Array.from(aSet).every((token) => bSet.has(token)) || Array.from(bSet).every((token) => aSet.has(token));
  if (subset && intersection >= 1) return Math.max(base, 0.92);
  return base;
}

function comparePersonName(docName, candidateName) {
  const docTokens = personTokens(docName);
  const candidateTokens = personTokens(candidateName);
  if (docTokens.length === 0 || candidateTokens.length === 0) {
    return {
      score: 0.5,
      level: "inconclusive",
      mode: "missing_name",
      subsetMatch: false,
      surnameMatch: false,
      givenMatch: false,
    };
  }

  const docSet = new Set(docTokens);
  const candidateSet = new Set(candidateTokens);
  const intersection = candidateTokens.filter((token) => docSet.has(token));
  const overlapRatio = intersection.length / Math.max(candidateTokens.length, docTokens.length);
  const subsetMatch =
    candidateTokens.every((token) => docSet.has(token)) || docTokens.every((token) => candidateSet.has(token));

  const docSurnames = docTokens.slice(-2);
  const candidateSurnames = candidateTokens.slice(-2);
  const surnameMatch = candidateSurnames.some((token) => docSet.has(token)) && docSurnames.some((token) => candidateSet.has(token));
  const docGiven = docTokens.slice(0, Math.max(1, docTokens.length - Math.min(2, docTokens.length)));
  const candidateGiven = candidateTokens.slice(0, Math.max(1, candidateTokens.length - Math.min(2, candidateTokens.length)));
  const givenMatch = candidateGiven.some((token) => docSet.has(token)) || docGiven.some((token) => candidateSet.has(token));

  if (subsetMatch && surnameMatch && givenMatch) {
    return { score: 0.95, level: "high", mode: "name_subset_match", subsetMatch, surnameMatch, givenMatch };
  }
  if (surnameMatch && givenMatch && overlapRatio >= 0.45) {
    return { score: 0.82, level: "high", mode: "name_tolerant_match", subsetMatch, surnameMatch, givenMatch };
  }
  if (surnameMatch && (givenMatch || overlapRatio >= 0.34)) {
    return { score: 0.62, level: "medium", mode: "name_partial_match", subsetMatch, surnameMatch, givenMatch };
  }
  if (overlapRatio >= 0.25) {
    return { score: 0.4, level: "low", mode: "name_weak_match", subsetMatch, surnameMatch, givenMatch };
  }
  return { score: 0, level: "conflict", mode: "name_mismatch", subsetMatch, surnameMatch, givenMatch };
}

export function compareIdentityFuzzy(a, b) {
  const compared = comparePersonName(a, b);
  if (compared.level === "high") {
    return { identity_match: "high", score: compared.score, mode: compared.mode, details: compared };
  }
  if (compared.level === "medium") {
    return { identity_match: "medium", score: compared.score, mode: compared.mode, details: compared };
  }
  if (compared.level === "low" || compared.level === "inconclusive") {
    return {
      identity_match: compared.score >= 0.32 ? "low" : "none",
      score: compared.score,
      mode: compared.mode,
      details: compared,
    };
  }
  return { identity_match: "none", score: compared.score, mode: compared.mode, details: compared };
}

function compareCompanyName(extractedCompanyName, row) {
  const candidates = [
    { value: row?.company_name, source: "legal_name" },
    { value: row?.company_name_legal, source: "legal_name" },
    { value: row?.company_name_freeform, source: "commercial_name" },
    { value: row?.company_name_display, source: "commercial_name" },
  ].filter((entry) => String(entry.value || "").trim());

  if (!String(extractedCompanyName || "").trim()) {
    return { score: 0.5, source: null, matched_value: null };
  }

  let best = { score: 0, source: null, matched_value: null };
  for (const entry of candidates) {
    const score = companySimilarity(extractedCompanyName, entry.value);
    if (score > best.score) {
      best = { score, source: entry.source, matched_value: String(entry.value || "").trim() || null };
    }
  }
  return best;
}

function toMonthIndex(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return Number(iso[1]) * 12 + (Number(iso[2]) - 1);
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return Number(ym[1]) * 12 + (Number(ym[2]) - 1);
  const y = raw.match(/^(\d{4})$/);
  if (y) return Number(y[1]) * 12;
  return null;
}

function dateCompatibility(extractedStart, extractedEnd, recordStart, recordEnd) {
  const eStart = toMonthIndex(extractedStart);
  const eEnd = toMonthIndex(extractedEnd);
  const rStart = toMonthIndex(recordStart);
  const rEnd = toMonthIndex(recordEnd);

  if (eStart === null && eEnd === null) return 0.5;
  if (rStart === null && rEnd === null) return 0.5;

  const eS = eStart ?? eEnd;
  const eE = eEnd ?? eStart;
  const rS = rStart ?? rEnd;
  const rE = rEnd ?? rStart;

  if (eS === null || eE === null || rS === null || rE === null) return 0.35;

  const latestStart = Math.max(eS, rS);
  const earliestEnd = Math.min(eE, rE);
  const overlap = earliestEnd - latestStart + 1;
  if (overlap > 0) return 1;

  const distance = Math.min(Math.abs(eS - rE), Math.abs(rS - eE));
  if (distance <= 2) return 0.65;
  if (distance <= 6) return 0.35;
  return 0;
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeLooseDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
  const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
  const dash = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dash) return `${dash[3]}-${dash[2]}-${dash[1]}`;
  const monthYearDotted = raw.match(/^(\d{2})\.(\d{4})$/);
  if (monthYearDotted) return `${monthYearDotted[2]}-${monthYearDotted[1]}-01`;
  const ym = raw.match(/^(\d{2})\/(\d{4})$/);
  if (ym) return `${ym[2]}-${ym[1]}-01`;
  const ymIso = raw.match(/^(\d{4})-(\d{2})$/);
  if (ymIso) return `${ymIso[1]}-${ymIso[2]}-01`;
  const year = raw.match(/^(\d{4})$/);
  if (year) return `${year[1]}-01-01`;
  return null;
}

function extractDateTokens(value) {
  const matches = String(value || "").match(DATE_TOKEN_REGEX);
  return Array.isArray(matches) ? matches : [];
}

function detectAdministrativeIgnoredReason(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return VIDA_LABORAL_IGNORED_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))
    ? "administrative_non_employment_movement"
    : null;
}

export function normalizeEmploymentText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[|]+/g, " ")
    .replace(/[_-]{3,}/g, " ")
    .replace(/([A-Za-zÁÉÍÓÚÑ])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-zÁÉÍÓÚÑ])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectAdministrativeKeywords(value) {
  const normalized = normalizeText(value);
  const keywords = VIDA_LABORAL_ADMIN_KEYWORDS.filter((keyword) => normalized.includes(normalizeText(keyword)));
  return {
    matched: keywords.length > 0,
    keywords,
  };
}

export function detectSelfEmployment(value) {
  const normalized = normalizeText(value);
  const keywords = VIDA_LABORAL_SELF_EMPLOYMENT_KEYWORDS.filter((keyword) =>
    normalized.includes(normalizeText(keyword)),
  );
  return {
    matched: keywords.length > 0,
    keywords,
  };
}

export function normalizeCEACode(value) {
  const compact = String(value || "")
    .trim()
    .replace(/[\s.-]+/g, "")
    .toUpperCase();
  return compact || null;
}

function normalizeCEAId(value) {
  const compact = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return compact || null;
}

function extractFirstPageCandidateText(value) {
  const raw = String(value || "");
  if (!raw.trim()) return "";
  const pageBreak = raw.split(/\f|(?:\n\s*\n\s*\n)+|PAGE\s+2\b/i)[0];
  return String(pageBreak || raw).slice(0, 2500).trim();
}

export function extractVidaLaboralCEA(value) {
  const firstPage = extractFirstPageCandidateText(value);
  if (!firstPage) {
    return {
      cea_present: false,
      cea_id: null,
      cea_date: null,
      cea_code: null,
      cea_extraction_confidence: null,
    };
  }

  const normalized = firstPage.replace(/\r/g, "\n").replace(/\u00a0/g, " ");
  const normalizedHeader = normalizeText(normalized);
  const hasReferenceSection =
    normalizedHeader.includes("referencias electronicas") || normalizedHeader.includes("referencias electronicas");
  const ceaCodeMatch =
    normalized.match(/\b(?:codigo|c[oó]digo)\s+cea\b[:\s-]*([A-Z0-9][A-Z0-9\s.-]{5,})/i) ||
    normalized.match(/\bCEA\b[:\s-]*([A-Z0-9][A-Z0-9\s.-]{5,})/i);
  const ceaDateMatch =
    normalized.match(/\bfecha\b[:\s-]*(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})/i);
  const ceaIdMatch =
    normalized.match(/\bId\.?\s*CEA\b[:\s-]*([A-Z0-9][A-Z0-9\s.-]{3,})/i) ||
    normalized.match(/\bId(?:entificador)?\.?\s*CEA\b[:\s-]*([A-Z0-9][A-Z0-9\s.-]{3,})/i);

  const ceaCode = normalizeCEACode(ceaCodeMatch?.[1] || null);
  const ceaId = normalizeCEAId(ceaIdMatch?.[1] || null);
  const ceaDate = normalizeLooseDate(ceaDateMatch?.[1] || null);
  const present = Boolean(ceaCode || ceaId || ceaDate);
  const confidence = present
    ? clamp01(
        (hasReferenceSection ? 0.35 : 0) +
          (ceaCode ? 0.4 : 0) +
          (ceaDate ? 0.15 : 0) +
          (ceaId ? 0.1 : 0),
      )
    : null;

  return {
    cea_present: present,
    cea_id: ceaId,
    cea_date: ceaDate,
    cea_code: ceaCode,
    cea_extraction_confidence: confidence,
  };
}

export function extractVidaLaboralMetadata(value) {
  return extractVidaLaboralCEA(value);
}

export function extractProvincePrefixFromContributionCode(value) {
  const raw = String(value || "");
  const match = raw.match(
    /\b(?:ccc|c\.?c\.?c\.?|codigo cuenta cotizacion|código cuenta cotización)?\s*:?\s*(\d{2})\d{6,}\b/i,
  );
  const prefix = match?.[1] || null;
  if (!prefix) return { province_prefix: null, province_hint: null };
  if (prefix === "18") return { province_prefix: "18", province_hint: "Granada" };
  if (prefix === "08") return { province_prefix: "08", province_hint: "Barcelona" };
  return { province_prefix: prefix, province_hint: null };
}

function detectLaborRelationshipPattern(value, provinceMeta = {}) {
  const raw = String(value || "");
  const normalized = normalizeText(raw);
  if (!normalized) return { matched: false, reasons: [] };

  const reasons = [];
  const hasContributionCode =
    /\b(?:ccc|c\.?c\.?c\.?|codigo cuenta cotizacion|código cuenta cotización)\b/i.test(raw) ||
    /\b\d{2}\d{6,}\b/.test(raw);
  if (hasContributionCode) reasons.push("contribution_code");

  if (provinceMeta?.province_hint) reasons.push(`province:${provinceMeta.province_hint.toLowerCase()}`);

  if (/\b(?:regimen general|régimen general|empresa|empresario|alta|baja|cotizacion|cotización|ccc)\b/i.test(raw)) {
    reasons.push("labor_structure");
  }

  return { matched: reasons.length > 0, reasons };
}

function detectStructuralLaborPattern(value, startDate, endDate, provinceMeta = {}) {
  const raw = String(value || "");
  if (!raw.trim()) return { matched: false, reasons: [] };

  const reasons = [];
  const dateTokens = extractDateTokens(raw);
  const hasTemporalWindow = Boolean(startDate || endDate);
  const hasDatePair = dateTokens.length >= 2;
  const hasContributionCode =
    /\b(?:ccc|c\.?c\.?c\.?|codigo cuenta cotizacion|código cuenta cotización)\b/i.test(raw) ||
    /\b\d{2}\d{6,}\b/.test(raw);
  const hasLifeReportSequence =
    /\b\d{2}\d{6,}\b.*?(?:\d{2}[/-]\d{2}[/-]\d{4}|\d{2}[/-]\d{4}|\d{4}-\d{2}).*?(?:\d{2}[/-]\d{2}[/-]\d{4}|\d{2}[/-]\d{4}|\d{4}-\d{2}|\bactualidad\b)?/i.test(
      raw,
    ) ||
    /\b(?:alta|baja)\b.*?(?:\d{2}[/-]\d{2}[/-]\d{4}|\d{2}[/-]\d{4}|\d{4}-\d{2})/i.test(raw);

  if (hasDatePair) reasons.push("date_pair");
  if (hasContributionCode) reasons.push("contribution_code");
  if (hasLifeReportSequence) reasons.push("vida_laboral_sequence");
  if (provinceMeta?.province_hint) reasons.push(`province:${provinceMeta.province_hint.toLowerCase()}`);

  const matched =
    hasTemporalWindow &&
    ((hasDatePair && hasContributionCode) || hasLifeReportSequence || (hasDatePair && provinceMeta?.province_hint));

  return { matched, reasons };
}

function isVidaLaboralLegalNoise(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return VIDA_LABORAL_LEGAL_NOISE_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function normalizeVidaLaboralText(text) {
  return normalizeEmploymentText(text)
    .replace(/\r/g, "\n")
    .replace(/([A-ZÁÉÍÓÚÑ]{3,})\s+(?=\d{2}[/-]\d{2}[/-]\d{4}|\d{2}[/-]\d{4}|\d{4}-\d{2})/g, "$1\n")
    .replace(new RegExp(`(${DATE_PAIR_SOURCE})`, "g"), "\n$1")
    .replace(/\b(AUTONOMO|AUTÓNOMO|RETA|PRESTACION|PRESTACIÓN|SUBSIDIO|EXTINCION|EXTINCIÓN|SUSPENSION|SUSPENSIÓN|VACACIONES RETRIBUIDAS|INCAPACIDAD|MATERNIDAD|PATERNIDAD)\b/g, "\n$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalizeVidaLaboralTableLayout(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\b(GENERAL|RETA|AUTONOMO|AUTÓNOMO|REGIMEN ESPECIAL TRABAJADORES AUTONOMOS|RÉGIMEN ESPECIAL TRABAJADORES AUTÓNOMOS)\b/g, "\n$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function findDateTokenIndexes(segment) {
  return Array.from(String(segment || "").matchAll(DATE_TOKEN_REGEX)).map((match) => ({
    token: String(match[0] || "").trim(),
    index: Number(match.index || 0),
  }));
}

function resolveVidaLaboralRowEndDate(segment, dateTokens) {
  const raw = String(segment || "");
  if (/(?:\b---+\b|\bactualidad\b|\ben alta\b|\bsin baja\b)/i.test(raw)) return null;
  if (!Array.isArray(dateTokens) || dateTokens.length === 0) return null;
  if (dateTokens.length >= 3) return normalizeLooseDate(dateTokens[2]?.token || null);
  if (dateTokens.length === 2) {
    const first = normalizeLooseDate(dateTokens[0]?.token || null);
    const second = normalizeLooseDate(dateTokens[1]?.token || null);
    if (first && second && first !== second) return second;
  }
  return null;
}

function extractContributionCode(value) {
  const raw = String(value || "");
  const match =
    raw.match(/\b(?:general|reta|autonomo|autónomo)?\s*(\d{10,12})\b/i) ||
    raw.match(/\bccc\b[:\s-]*(\d{10,12})\b/i);
  return String(match?.[1] || "").trim() || null;
}

function hasLongNumber(value) {
  return /\b\d{9,}\b/.test(String(value || ""));
}

function hasDate(value) {
  return extractDateTokens(value).length > 0;
}

function isVidaLaboralRow(line) {
  const raw = String(line || "").trim();
  return Boolean(raw) && VIDA_LABORAL_REGIMEN_REGEX.test(raw) && hasLongNumber(raw) && hasDate(raw);
}

function normalizeVidaLaboralCompany(value) {
  return String(value || "")
    .replace(/\b(?:general|autonomo|autónomo|reta|regimen especial trabajadores autonomos|régimen especial trabajadores autónomos)\b/gi, " ")
    .replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isDateLikeValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  return (
    /^\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?$/.test(raw) ||
    /^\d{4}[./-]\d{2}(?:[./-]\d{2})?$/.test(raw) ||
    /^\d+$/.test(raw)
  );
}

function isPlausibleVidaLaboralCompany(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length < 3) return false;
  if (isDateLikeValue(raw)) return false;
  if (!/[A-ZÁÉÍÓÚÑ]/i.test(raw)) return false;
  return true;
}

export function extractVidaLaboralTabularRows(text) {
  const normalized = normalizeVidaLaboralTableLayout(text);
  if (!normalized) return [];

  const lines = normalized
    .split(/\n+/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  const rows = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isVidaLaboralRow(line)) continue;
    if (isVidaLaboralLegalNoise(line)) continue;

    const dateTokens = findDateTokenIndexes(line);
    if (dateTokens.length === 0) continue;

    const contributionCode = extractContributionCode(line);
    if (!contributionCode) continue;

    const normalizedLine = line.replace(/\s+/g, " ").trim();
    const contributionIndex = normalizedLine.indexOf(contributionCode);
    if (contributionIndex < 0) continue;

    const afterContribution = normalizedLine.slice(contributionIndex + contributionCode.length).trim();
    const firstDateToken = dateTokens[0]?.token || "";
    const firstDateIndex = firstDateToken ? afterContribution.indexOf(firstDateToken) : -1;
    if (firstDateIndex < 0) continue;

    const employerRaw = afterContribution.slice(0, firstDateIndex).trim();
    const employerCandidate =
      normalizeVidaLaboralCompany(employerRaw) ||
      normalizeVidaLaboralCompany(extractCompanyNameFromVidaLaboralSegment(employerRaw) || "") ||
      normalizeVidaLaboralCompany(cleanupVidaLaboralCompanyText(employerRaw) || "");
    if (!isPlausibleVidaLaboralCompany(employerCandidate)) continue;

    const selfEmployment = detectSelfEmployment(`${employerRaw} ${line}`);
    const provinceMeta = extractProvincePrefixFromContributionCode(`${contributionCode || ""} ${line}`);
    const startDate = normalizeLooseDate(dateTokens[0]?.token || null);
    const endDate = resolveVidaLaboralRowEndDate(line, dateTokens);
    const administrative = detectAdministrativeKeywords(`${employerCandidate || ""} ${line}`);
    const ignoredReason = detectAdministrativeIgnoredReason(`${employerCandidate || ""} ${line}`);
    const hasUsableEmployer = Boolean(employerCandidate) || selfEmployment.matched;

    if (!hasUsableEmployer || !startDate) continue;

    const companyName =
      employerCandidate || (selfEmployment.matched ? "TRABAJO POR CUENTA PROPIA / AUTONOMO" : "EMPRESA DETECTADA");

    console.log("TABULAR_ROW_PARSED", {
      company: companyName,
      start_date: startDate,
      end_date: endDate,
    });

    rows.push({
      raw_block_index: index,
      text: line,
      company_name: companyName,
      start_date: startDate,
      end_date: endDate,
      contribution_code: contributionCode,
      province_prefix: provinceMeta.province_prefix,
      province_hint: provinceMeta.province_hint,
      self_employment_matched: Boolean(selfEmployment.matched),
      administrative_matched: Boolean(administrative.matched),
      ignored_reason: ignoredReason,
      split_from_parent: false,
      split_reason: ["tabular_row"],
      classification_reasons: ["tabular_row_canonical"],
    });
  }

  return rows;
}

export function splitIntoRawMovementBlocks(text) {
  const normalized = normalizeVidaLaboralText(text);
  if (!normalized) return [];

  const rawParts = normalized
    .split(/\n+/)
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  const segments = [];
  let current = "";
  let currentReasons = [];
  let rawBlockIndex = 0;
  for (const part of rawParts) {
    const hasDate = extractDateTokens(part).length > 0;
    const startsMovement = VIDA_LABORAL_MOVEMENT_START_REGEX.test(part);
    const splitReasons = [];
    if (hasDate) splitReasons.push("strong_date_pattern");
    if (!hasDate && startsMovement) splitReasons.push("movement_keyword");
    if (startsMovement && current) {
      const currentAdmin = detectAdministrativeKeywords(current).matched;
      const nextAdmin = detectAdministrativeKeywords(part).matched;
      const currentSelf = detectSelfEmployment(current).matched;
      const nextSelf = detectSelfEmployment(part).matched;
      if ((currentAdmin && !nextAdmin) || (!currentAdmin && nextAdmin) || (currentSelf && !nextSelf) || (!currentSelf && nextSelf)) {
        splitReasons.push("incompatible_submovement");
      }
    }

    if (splitReasons.length > 0) {
      if (current) {
        segments.push({
          raw_block_index: rawBlockIndex,
          text: current.trim(),
          split_from_parent: rawBlockIndex > 0,
          split_reason: currentReasons.length ? currentReasons : ["movement_boundary"],
        });
        rawBlockIndex += 1;
      }
      current = part;
      currentReasons = splitReasons;
    } else if (current) {
      current = `${current} ${part}`.trim();
    } else {
      current = part;
      currentReasons = ["initial_block"];
    }
  }
  if (current) {
    segments.push({
      raw_block_index: rawBlockIndex,
      text: current.trim(),
      split_from_parent: rawBlockIndex > 0,
      split_reason: currentReasons.length ? currentReasons : ["trailing_block"],
    });
  }

  return segments
    .map((segment) => ({
      ...segment,
      text: String(segment.text || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((segment) => Boolean(segment.text));
}

function looksLikeCompanyFragment(value) {
  const tokens = companyTokens(value);
  return tokens.length >= 1 && String(value || "").replace(/\s+/g, " ").trim().length >= 3;
}

function cleanupVidaLaboralCompanyText(value) {
  const cleaned = normalizeEmploymentText(value)
    .replace(DATE_TOKEN_REGEX, " ")
    .replace(/\b(?:empresa|empresario|razon social|razón social|nif|cif|naf|ccc|situacion|situación|tipo|contrato|coeficiente|grupo|epigrafe|epígrafe|dias|días|regimen|régimen|provincia|clave)\b/gi, " ")
    .replace(/\b\d{6,}\b/g, " ")
    .replace(/\bgeneral\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const pieces = cleaned
    .split(/\s+/)
    .filter((token) => token && !VIDA_LABORAL_STOPWORDS.has(normalizeText(token)));

  return pieces.join(" ").trim();
}

function extractMercantileNameCandidates(value) {
  const raw = normalizeEmploymentText(value)
    .replace(DATE_TOKEN_REGEX, " ")
    .replace(/\b\d{5,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return [];

  const suffixMatches = Array.from(
    raw.matchAll(/\b([A-ZÁÉÍÓÚÑA-Za-záéíóúñ][A-ZÁÉÍÓÚÑA-Za-záéíóúñ\s]{1,80}?\s(?:S\.?\s?L\.?U?|S\.?\s?L\.?|S\.?\s?A\.?))\b/g),
  ).map((match) => String(match[1] || "").trim());

  const plainPhraseMatches = Array.from(
    raw.matchAll(/\b([A-ZÁÉÍÓÚÑA-Za-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑA-Za-záéíóúñ]{2,}){0,4})\b/g),
  )
    .map((match) => String(match[1] || "").trim())
    .filter((candidate) => {
      const tokens = candidate
        .split(/\s+/)
        .map((token) => normalizeText(token))
        .filter(Boolean);
      if (tokens.length === 0) return false;
      if (tokens.every((token) => VIDA_LABORAL_STOPWORDS.has(token))) return false;
      return tokens.some((token) => token.length >= 3 && !VIDA_LABORAL_STOPWORDS.has(token));
    });

  return Array.from(new Set([...suffixMatches, ...plainPhraseMatches])).sort((a, b) => b.length - a.length);
}

function extractCompanyNameFromVidaLaboralSegment(segment) {
  const raw = String(segment || "").trim();
  if (!raw) return null;

  const afterEmpresa = raw.match(/\bempresa\b[:\s-]*(.+)$/i);
  const candidate = afterEmpresa ? afterEmpresa[1] : raw;
  const cleaned = cleanupVidaLaboralCompanyText(candidate);
  const mercantileCandidates = extractMercantileNameCandidates(candidate);
  const bestCandidate = mercantileCandidates.find((item) => looksLikeCompanyFragment(cleanupVidaLaboralCompanyText(item)));
  const resolved = bestCandidate ? cleanupVidaLaboralCompanyText(bestCandidate) : cleaned;
  if (!looksLikeCompanyFragment(resolved)) return null;
  return resolved;
}

export function normalizeEmployerKey(value) {
  const normalized = normalizeEmploymentText(value)
    .toUpperCase()
    .replace(/[.,/]+/g, " ")
    .replace(/\bS\.?\s*L\.?\s*U?\b/g, " ")
    .replace(/\bS\.?\s*A\.?\b/g, " ")
    .replace(/\bSOCIEDAD\s+LIMITADA\b/g, " ")
    .replace(/\bSOCIEDAD\s+ANONIMA\b/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized
    .split(" ")
    .map((token) => normalizeText(token))
    .filter((token) => token.length >= 2 && !VIDA_LABORAL_STOPWORDS.has(token) && !COMPANY_STOPWORDS.has(token));
  return tokens.slice(0, 8).join(" ").trim() || null;
}

function pickBestCompanyName(entries) {
  return [...entries]
    .map((entry) => String(entry?.company_name || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || "Empresa detectada";
}

function mergeEntryDate(entries, field, mode) {
  const dated = entries
    .map((entry) => ({ raw: String(entry?.[field] || "").trim(), idx: toMonthIndex(entry?.[field]) }))
    .filter((entry) => entry.raw && entry.idx != null)
    .sort((a, b) => (mode === "min" ? a.idx - b.idx : b.idx - a.idx));
  return dated[0]?.raw || null;
}

export function groupAndMergeEmploymentEntries(entries = []) {
  const employmentEntries = (Array.isArray(entries) ? entries : []).filter(
    (entry) => String(entry?.type || "").trim() === "employment",
  );
  const groups = new Map();

  for (const entry of employmentEntries) {
    const selfEmployment = Boolean(entry?.self_employment) || String(entry?.subtype || "") === "self_employment";
    const employerKey = normalizeEmployerKey(entry?.company_name);
    const provincePrefix = String(entry?.province_prefix || "").trim();
    const provinceHint = String(entry?.province_hint || "").trim();
    const suggestedMatchId = String(entry?.suggested_match_employment_record_id || "").trim();
    const groupingKey = selfEmployment
      ? ["self_employment", employerKey || "autonomo", provincePrefix || provinceHint || "none"].join("|")
      : [employerKey || "unknown_employer", provincePrefix || provinceHint || "none", suggestedMatchId || "no_match"].join("|");

    const current = groups.get(groupingKey) || [];
    current.push(entry);
    groups.set(groupingKey, current);
  }

  return Array.from(groups.entries())
    .map(([groupKey, groupEntries], index) => {
      const companyName = pickBestCompanyName(groupEntries);
      const normalizedCompanyKey = normalizeEmployerKey(companyName) || groupKey;
      const startDate = mergeEntryDate(groupEntries, "start_date", "min");
      const missingEnd = groupEntries.some((entry) => !String(entry?.end_date || "").trim());
      const endDate = missingEnd ? null : mergeEntryDate(groupEntries, "end_date", "max");
      const sourceBlockIndexes = Array.from(
        new Set(
          groupEntries
            .map((entry) => Number(entry?.raw_block_index))
            .filter((value) => Number.isFinite(value)),
        ),
      ).sort((a, b) => a - b);
      const sourceEntryIds = Array.from(
        new Set(groupEntries.map((entry) => String(entry?.entry_id || "").trim()).filter(Boolean)),
      );
      const classificationReasons = Array.from(
        new Set(groupEntries.flatMap((entry) => (Array.isArray(entry?.classification_reasons) ? entry.classification_reasons : []))),
      );
      const confidenceValues = groupEntries.map((entry) => Number(entry?.confidence || 0)).filter((value) => Number.isFinite(value));
      const groupScore = clamp01(
        (confidenceValues.reduce((acc, value) => acc + value, 0) / Math.max(confidenceValues.length, 1)) +
          Math.min(0.15, Math.max(0, groupEntries.length - 1) * 0.05),
      );
      const suggestedScores = groupEntries
        .map((entry) => ({
          id: String(entry?.suggested_match_employment_record_id || "").trim(),
          score: Number(entry?.suggested_match_score || 0),
        }))
        .filter((entry) => entry.id);
      suggestedScores.sort((a, b) => b.score - a.score);
      const linkedEmploymentRecordId =
        groupEntries.map((entry) => String(entry?.linked_employment_record_id || "").trim()).filter(Boolean)[0] || null;
      const reconciliationChoice =
        groupEntries.map((entry) => String(entry?.reconciliation_choice || "").trim()).filter(Boolean)[0] || null;
      const reconciliationStatus =
        linkedEmploymentRecordId
          ? "linked"
          : groupEntries.every((entry) => String(entry?.reconciliation_status || "").trim() === "ignored")
            ? "ignored"
            : "pending";

      return {
        entry_id: `grouped_vida_laboral_${index + 1}`,
        type: "employment",
        subtype: groupEntries.some((entry) => entry?.self_employment) ? "self_employment" : null,
        self_employment: groupEntries.some((entry) => entry?.self_employment),
        company_name: companyName,
        normalized_company_key: normalizedCompanyKey,
        start_date: startDate,
        end_date: endDate,
        is_current: missingEnd,
        confidence: groupScore,
        group_score: groupScore,
        province_prefix:
          groupEntries.map((entry) => String(entry?.province_prefix || "").trim()).filter(Boolean)[0] || null,
        province_hint:
          groupEntries.map((entry) => String(entry?.province_hint || "").trim()).filter(Boolean)[0] || null,
        suggested_match_employment_record_id: suggestedScores[0]?.id || null,
        linked_employment_record_id: linkedEmploymentRecordId,
        reconciliation_status: reconciliationStatus,
        reconciliation_choice: reconciliationChoice,
        source_entry_count: sourceEntryIds.length,
        source_entry_ids: sourceEntryIds,
        source_block_indexes: sourceBlockIndexes,
        classification_reasons: classificationReasons,
        concise_summary: `${companyName} · ${startDate || "—"} — ${missingEnd ? "Actualidad" : endDate || "—"}`,
        raw_text: null,
      };
    })
    .sort((a, b) => {
      const aDate = toMonthIndex(a?.end_date || a?.start_date || "") ?? -1;
      const bDate = toMonthIndex(b?.end_date || b?.start_date || "") ?? -1;
      return bDate - aDate;
    });
}

export function scoreEmploymentCandidate({
  segment,
  companyName,
  startDate,
  endDate,
  employmentRecords,
  selfEmployment,
  provinceHint,
} = {}) {
  const normalizedSegment = normalizeEmploymentText(segment);
  const alphaChars = (normalizedSegment.match(/[a-záéíóúñ]/gi) || []).length;
  const numericChars = (normalizedSegment.match(/\d/g) || []).length;
  const numericDensity = alphaChars === 0 ? 1 : numericChars / Math.max(alphaChars, 1);
  const adminSignals = detectAdministrativeKeywords(normalizedSegment);
  const employerPlausibility = looksLikeCompanyFragment(companyName)
    ? Math.min(1, companyTokens(companyName).length / 3 + 0.35)
    : 0;
  const datePlausibility = startDate && endDate ? 1 : startDate || endDate ? 0.65 : 0;
  const numericNoisePenalty = numericDensity >= 1.15 ? 0.45 : numericDensity >= 0.75 ? 0.2 : 0;
  const administrativePenalty = adminSignals.matched ? 0.8 : 0;
  const selfEmploymentBonus = selfEmployment?.matched && datePlausibility >= 0.65 ? 0.22 : 0;
  const generalNoisePenalty = /^general[\d-]*/i.test(String(segment || "").trim()) ? 0.35 : 0;
  let existingMatchBonus = 0;

  for (const row of Array.isArray(employmentRecords) ? employmentRecords : []) {
    const companyMatch = compareCompanyName(companyName, row).score;
    const dateScore = dateCompatibility(startDate, endDate, row?.start_date, row?.end_date);
    let candidateScore = companyMatch * 0.7 + dateScore * 0.3;
    if (provinceHint && normalizeText(row?.company_name_freeform || row?.company_name || "").includes(normalizeText(provinceHint))) {
      candidateScore += 0.05;
    }
    existingMatchBonus = Math.max(existingMatchBonus, clamp01(candidateScore) * 0.25);
  }

  const provincePrefixConfidence = provinceHint ? 0.08 : 0;
  const score = clamp01(
    employerPlausibility * 0.42 +
      datePlausibility * 0.28 +
      Math.min(alphaChars / 24, 1) * 0.15 +
      existingMatchBonus +
      selfEmploymentBonus +
      provincePrefixConfidence -
      administrativePenalty -
      numericNoisePenalty -
      generalNoisePenalty,
  );
  const classificationReasons = [];
  if (employerPlausibility >= 0.55) classificationReasons.push("plausible_employer");
  if (datePlausibility >= 0.65) classificationReasons.push("reasonable_dates");
  if (existingMatchBonus >= 0.12) classificationReasons.push("partial_existing_experience_match");
  if (selfEmployment?.matched) classificationReasons.push("self_employment_pattern");
  if (provinceHint) classificationReasons.push(`province_hint:${provinceHint}`);
  if (adminSignals.matched) classificationReasons.push("administrative_keywords");
  if (numericNoisePenalty > 0) classificationReasons.push("numeric_noise");
  if (generalNoisePenalty > 0) classificationReasons.push("ocr_general_noise");

  return {
    score,
    employer_plausibility: employerPlausibility,
    date_plausibility: datePlausibility,
    administrative_keyword_penalty: administrativePenalty,
    numeric_noise_penalty: numericNoisePenalty,
    self_employment_bonus: selfEmploymentBonus,
    province_prefix_confidence: provincePrefixConfidence,
    classification_reasons: classificationReasons,
  };
}

export function extractVidaLaboralEmploymentEntriesWithDebug({ text, extraction, employmentRecords } = {}) {
  const rows = Array.isArray(employmentRecords) ? employmentRecords : [];
  const tabularRows = extractVidaLaboralTabularRows(text);
  const rawBlocks = tabularRows.length > 0
    ? tabularRows.map((row) => ({
        raw_block_index: row.raw_block_index,
        text: row.text,
        split_from_parent: row.split_from_parent,
        split_reason: row.split_reason,
        canonical_row: row,
      }))
    : splitIntoRawMovementBlocks(text);
  const extractedEntries = [];
  const debugEntries = [];
  const EMPLOYMENT_SCORE_THRESHOLD = 0.46;
  const SELF_EMPLOYMENT_SCORE_THRESHOLD = 0.4;
  const LOW_CONFIDENCE_PROMOTION_THRESHOLD = 0.55;
  const rawText = String(text || "");
  const rawBlocksBeforeSplit = rawText
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  for (let index = 0; index < rawBlocks.length; index += 1) {
    const rawBlock = rawBlocks[index];
    const segment = String(rawBlock?.text || "").trim();
    if (!segment) continue;
    const canonicalRow = rawBlock?.canonical_row && typeof rawBlock.canonical_row === "object" ? rawBlock.canonical_row : null;
    const debugEntryBase = {
      raw_block_index: Number(rawBlock?.raw_block_index || index),
      normalized_excerpt: segment.slice(0, 220),
      province_prefix: canonicalRow?.province_prefix || null,
      province_hint: canonicalRow?.province_hint || null,
      split_from_parent: Boolean(rawBlock?.split_from_parent),
      split_reason: Array.isArray(rawBlock?.split_reason) ? rawBlock.split_reason : [],
    };
    if (isVidaLaboralLegalNoise(segment)) {
      debugEntries.push({
        ...debugEntryBase,
        company_name: null,
        start_date: null,
        end_date: null,
        self_employment_matched: false,
        administrative_matched: false,
        numeric_noise_penalty: 0,
        classification_score: 0,
        has_labor_pattern: false,
        has_structural_labor_pattern: false,
        type: "discarded",
        classification_reasons: ["legal_noise_discarded"],
        ignored_reason: "legal_noise",
      });
      continue;
    }
    const dateTokens = extractDateTokens(segment);
    if (dateTokens.length === 0) {
      debugEntries.push({
        ...debugEntryBase,
        company_name: null,
        start_date: null,
        end_date: null,
        self_employment_matched: false,
        administrative_matched: false,
        numeric_noise_penalty: 0,
        classification_score: 0,
        has_labor_pattern: false,
        has_structural_labor_pattern: false,
        type: "discarded",
        classification_reasons: ["missing_dates"],
        ignored_reason: null,
      });
      continue;
    }

    const startDate = canonicalRow?.start_date || normalizeLooseDate(dateTokens[0]);
    const endDate = canonicalRow?.end_date ?? normalizeLooseDate(dateTokens[1] || null);
    const companyName = canonicalRow?.company_name || extractCompanyNameFromVidaLaboralSegment(segment);
    const selfEmployment = canonicalRow
      ? { matched: Boolean(canonicalRow?.self_employment_matched), keywords: canonicalRow?.self_employment_matched ? ["autonomo"] : [] }
      : detectSelfEmployment(segment);
    const provinceMeta = canonicalRow
      ? {
          province_prefix: canonicalRow?.province_prefix || null,
          province_hint: canonicalRow?.province_hint || null,
        }
      : extractProvincePrefixFromContributionCode(segment);
    const laborPattern = detectLaborRelationshipPattern(segment, provinceMeta);
    const structuralLaborPattern = detectStructuralLaborPattern(segment, startDate, endDate, provinceMeta);
    const ignoredReason = canonicalRow?.ignored_reason || detectAdministrativeIgnoredReason(`${companyName || ""} ${segment}`);
    const administrative = canonicalRow
      ? { matched: Boolean(canonicalRow?.administrative_matched), keywords: canonicalRow?.administrative_matched ? ["administrative"] : [] }
      : detectAdministrativeKeywords(`${companyName || ""} ${segment}`);
    const classification = scoreEmploymentCandidate({
      segment,
      companyName,
      startDate,
      endDate,
      employmentRecords: rows,
      selfEmployment,
      provinceHint: provinceMeta.province_hint,
    });
    const hasUsableDates = Boolean(startDate || endDate);
    const hasPlausibleEmployer = Boolean(companyName) && classification.employer_plausibility >= 0.3;
    const hasLaborPattern = laborPattern.matched;
    const hasStructuralLaborPattern = structuralLaborPattern.matched;
    const isCanonicalTableRow = Boolean(canonicalRow && companyName && startDate);
    const hasStrongLaborSignal =
      Boolean(selfEmployment.matched) ||
      hasLaborPattern ||
      hasStructuralLaborPattern ||
      isCanonicalTableRow ||
      (hasPlausibleEmployer && classification.date_plausibility >= 0.65);
    const dominatedByNumericNoise = hasStrongLaborSignal
      ? classification.numeric_noise_penalty > 0.45
      : classification.numeric_noise_penalty >= 0.45;
    const promotedLowConfidence =
      !administrative.matched &&
      !ignoredReason &&
      hasUsableDates &&
      !dominatedByNumericNoise &&
      ((classification.score >= EMPLOYMENT_SCORE_THRESHOLD) ||
        hasLaborPattern ||
        hasStructuralLaborPattern ||
        isCanonicalTableRow ||
        (selfEmployment.matched && classification.score >= SELF_EMPLOYMENT_SCORE_THRESHOLD)) &&
      classification.score < LOW_CONFIDENCE_PROMOTION_THRESHOLD;

    let entryType = "discarded";
    if (ignoredReason || administrative.matched) {
      entryType = "administrative";
    } else if (
      hasUsableDates &&
      !dominatedByNumericNoise &&
      ((classification.score >= EMPLOYMENT_SCORE_THRESHOLD) ||
        hasLaborPattern ||
        hasStructuralLaborPattern ||
        isCanonicalTableRow ||
        (selfEmployment.matched && classification.score >= SELF_EMPLOYMENT_SCORE_THRESHOLD))
    ) {
      entryType = "employment";
    }
    const classificationReasons = Array.isArray(classification.classification_reasons)
      ? [...classification.classification_reasons]
      : [];
    if (!hasPlausibleEmployer && hasLaborPattern) classificationReasons.push("no_employer_but_labor_pattern");
    if (hasStructuralLaborPattern) classificationReasons.push("structural_labor_pattern");
    if (isCanonicalTableRow) classificationReasons.push("tabular_row_canonical");
    for (const reason of laborPattern.reasons) {
      classificationReasons.push(`labor_pattern:${reason}`);
    }
    if (hasStructuralLaborPattern) {
      for (const reason of structuralLaborPattern.reasons) {
        classificationReasons.push(`structural_pattern:${reason}`);
      }
    }
    if (promotedLowConfidence) classificationReasons.push("promoted_low_confidence");
    debugEntries.push({
      ...debugEntryBase,
      company_name: companyName || null,
      start_date: startDate,
      end_date: endDate,
      self_employment_matched: Boolean(selfEmployment.matched),
      administrative_matched: Boolean(administrative.matched),
      numeric_noise_penalty: Number(classification.numeric_noise_penalty || 0),
      classification_score: Number(classification.score || 0),
      has_labor_pattern: Boolean(hasLaborPattern),
      has_structural_labor_pattern: Boolean(hasStructuralLaborPattern),
      province_prefix: provinceMeta.province_prefix,
      province_hint: provinceMeta.province_hint,
      type: entryType,
      classification_reasons: classificationReasons,
      ignored_reason: ignoredReason,
    });
    if (entryType === "discarded") continue;

    let suggestedMatchEmploymentRecordId = null;
    let suggestedMatchScore = 0;

    if (entryType === "employment") {
      for (const row of rows) {
        const companyMatch = compareCompanyName(companyName, row);
        const dateScore = dateCompatibility(startDate, endDate, row?.start_date, row?.end_date);
        const startExact = startDate && row?.start_date && normalizeLooseDate(startDate) === normalizeLooseDate(row?.start_date) ? 1 : 0;
        const endAligned =
          (!endDate && !row?.end_date) || (endDate && row?.end_date && normalizeLooseDate(endDate) === normalizeLooseDate(row?.end_date))
            ? 1
            : 0;
        const currentAligned = !endDate && !row?.end_date ? 1 : 0;
        const score = clamp01(
          companyMatch.score * 0.5 +
            dateScore * 0.25 +
            startExact * 0.2 +
            Math.max(endAligned * 0.03, currentAligned * 0.05),
        );
        if (score > suggestedMatchScore) {
          suggestedMatchScore = score;
          suggestedMatchEmploymentRecordId = String(row?.id || "") || null;
        }
      }
    }

    extractedEntries.push({
      entry_id: `vida_laboral_${index + 1}`,
      type: entryType,
      company_name:
        companyName || (selfEmployment.matched ? "Trabajo por cuenta propia / Autónomo" : "Empresa detectada"),
      position: null,
      start_date: startDate,
      end_date: endDate,
      confidence: clamp01(
        classification.score * 0.75 +
          (suggestedMatchScore >= 0.7 ? 0.15 : suggestedMatchScore >= 0.5 ? 0.08 : 0) +
          (selfEmployment.matched ? 0.05 : 0),
      ),
      ignored_reason: ignoredReason,
      suggested_match_employment_record_id: suggestedMatchEmploymentRecordId,
      suggested_match_score: suggestedMatchScore,
      reconciliation_status: entryType === "employment" ? "pending" : "ignored",
      reconciliation_choice: entryType === "employment" ? null : "ignore",
      linked_employment_record_id: null,
      subtype: selfEmployment.matched ? "self_employment" : null,
      self_employment: Boolean(selfEmployment.matched),
      contribution_code: canonicalRow?.contribution_code || extractContributionCode(segment),
      province_prefix: provinceMeta.province_prefix,
      province_hint: provinceMeta.province_hint,
      classification_reasons: classificationReasons,
      score_breakdown: {
        ...classification,
        labor_pattern_matched: hasLaborPattern,
        labor_pattern_reasons: laborPattern.reasons,
        structural_labor_pattern_matched: hasStructuralLaborPattern,
        structural_labor_pattern_reasons: structuralLaborPattern.reasons,
        promotion_threshold: selfEmployment.matched ? SELF_EMPLOYMENT_SCORE_THRESHOLD : EMPLOYMENT_SCORE_THRESHOLD,
        promoted_low_confidence: promotedLowConfidence,
      },
      raw_block_index: Number(rawBlock?.raw_block_index || 0),
      split_from_parent: Boolean(rawBlock?.split_from_parent),
      split_reason: Array.isArray(rawBlock?.split_reason) ? rawBlock.split_reason : [],
      raw_text: segment,
    });
  }

  if (extractedEntries.length === 0 && (extraction?.company_name || extraction?.start_date || extraction?.end_date)) {
    const fallbackText = `${String(extraction?.company_name || "")} ${String(extraction?.job_title || "")}`.trim();
    const selfEmployment = detectSelfEmployment(fallbackText);
    const provinceMeta = extractProvincePrefixFromContributionCode(
      `${String(extraction?.employer_identifier || "")} ${fallbackText}`,
    );
    const laborPattern = detectLaborRelationshipPattern(
      `${String(extraction?.employer_identifier || "")} ${fallbackText}`,
      provinceMeta,
    );
    const ignoredReason = detectAdministrativeIgnoredReason(fallbackText);
    const administrative = detectAdministrativeKeywords(fallbackText);
    const classification = scoreEmploymentCandidate({
      segment: fallbackText,
      companyName: String(extraction?.company_name || "").trim(),
      startDate: normalizeLooseDate(extraction?.start_date),
      endDate: normalizeLooseDate(extraction?.end_date),
      employmentRecords: rows,
      selfEmployment,
      provinceHint: provinceMeta.province_hint,
    });
    const fallbackHasUsableDates = Boolean(normalizeLooseDate(extraction?.start_date) || normalizeLooseDate(extraction?.end_date));
    const fallbackStructuralLaborPattern = detectStructuralLaborPattern(
      `${String(extraction?.employer_identifier || "")} ${fallbackText}`,
      normalizeLooseDate(extraction?.start_date),
      normalizeLooseDate(extraction?.end_date),
      provinceMeta,
    );
    const fallbackHasPlausibleEmployer =
      Boolean(String(extraction?.company_name || "").trim()) && classification.employer_plausibility >= 0.3;
    const fallbackHasLaborPattern = laborPattern.matched;
    const fallbackHasStructuralLaborPattern = fallbackStructuralLaborPattern.matched;
    const fallbackHasStrongLaborSignal =
      Boolean(selfEmployment.matched) ||
      fallbackHasLaborPattern ||
      fallbackHasStructuralLaborPattern ||
      (fallbackHasPlausibleEmployer && classification.date_plausibility >= 0.65);
    const fallbackDominatedByNumericNoise = fallbackHasStrongLaborSignal
      ? classification.numeric_noise_penalty > 0.45
      : classification.numeric_noise_penalty >= 0.45;
    const fallbackPromotedLowConfidence =
      !administrative.matched &&
      !ignoredReason &&
      fallbackHasUsableDates &&
      !fallbackDominatedByNumericNoise &&
      ((classification.score >= EMPLOYMENT_SCORE_THRESHOLD) ||
        fallbackHasLaborPattern ||
        fallbackHasStructuralLaborPattern ||
        (selfEmployment.matched && classification.score >= SELF_EMPLOYMENT_SCORE_THRESHOLD)) &&
      classification.score < LOW_CONFIDENCE_PROMOTION_THRESHOLD;
    const fallbackType =
      ignoredReason || administrative.matched
        ? "administrative"
        : fallbackHasUsableDates &&
            !fallbackDominatedByNumericNoise &&
            ((classification.score >= EMPLOYMENT_SCORE_THRESHOLD) ||
              fallbackHasLaborPattern ||
              fallbackHasStructuralLaborPattern ||
              (selfEmployment.matched && classification.score >= SELF_EMPLOYMENT_SCORE_THRESHOLD))
          ? "employment"
          : "discarded";
    debugEntries.push({
      raw_block_index: 0,
      normalized_excerpt: fallbackText.slice(0, 220),
      company_name: String(extraction?.company_name || "").trim() || null,
      start_date: normalizeLooseDate(extraction?.start_date),
      end_date: normalizeLooseDate(extraction?.end_date),
      self_employment_matched: Boolean(selfEmployment.matched),
      administrative_matched: Boolean(administrative.matched),
      numeric_noise_penalty: Number(classification.numeric_noise_penalty || 0),
      classification_score: Number(classification.score || 0),
      has_labor_pattern: Boolean(fallbackHasLaborPattern),
      has_structural_labor_pattern: Boolean(fallbackHasStructuralLaborPattern),
      province_prefix: provinceMeta.province_prefix,
      province_hint: provinceMeta.province_hint,
      type: fallbackType,
      classification_reasons: [],
      ignored_reason: ignoredReason,
      split_from_parent: false,
      split_reason: ["fallback_extraction"],
    });
    if (fallbackType !== "discarded") {
      const fallbackClassificationReasons = Array.isArray(classification.classification_reasons)
        ? [...classification.classification_reasons]
        : [];
      if (!fallbackHasPlausibleEmployer && fallbackHasLaborPattern) {
        fallbackClassificationReasons.push("no_employer_but_labor_pattern");
      }
      if (fallbackHasStructuralLaborPattern) fallbackClassificationReasons.push("structural_labor_pattern");
      for (const reason of laborPattern.reasons) {
        fallbackClassificationReasons.push(`labor_pattern:${reason}`);
      }
      if (fallbackHasStructuralLaborPattern) {
        for (const reason of fallbackStructuralLaborPattern.reasons) {
          fallbackClassificationReasons.push(`structural_pattern:${reason}`);
        }
      }
      if (fallbackPromotedLowConfidence) fallbackClassificationReasons.push("promoted_low_confidence");
      debugEntries[debugEntries.length - 1].classification_reasons = fallbackClassificationReasons;
      extractedEntries.push({
      entry_id: "vida_laboral_fallback_1",
      type: fallbackType,
      company_name:
        String(extraction?.company_name || "").trim() ||
        (selfEmployment.matched ? "Trabajo por cuenta propia / Autónomo" : "Empresa detectada"),
      position: String(extraction?.job_title || "").trim() || null,
      start_date: normalizeLooseDate(extraction?.start_date),
      end_date: normalizeLooseDate(extraction?.end_date),
      confidence: extraction?.confidence_score == null ? classification.score : clamp01(extraction.confidence_score),
      ignored_reason: ignoredReason,
      suggested_match_employment_record_id: null,
      suggested_match_score: 0,
      reconciliation_status: fallbackType === "employment" ? "pending" : "ignored",
      reconciliation_choice: fallbackType === "employment" ? null : "ignore",
      linked_employment_record_id: null,
      subtype: selfEmployment.matched ? "self_employment" : null,
      self_employment: Boolean(selfEmployment.matched),
      province_prefix: provinceMeta.province_prefix,
      province_hint: provinceMeta.province_hint,
      classification_reasons: fallbackClassificationReasons,
      score_breakdown: {
        ...classification,
        labor_pattern_matched: fallbackHasLaborPattern,
        labor_pattern_reasons: laborPattern.reasons,
        structural_labor_pattern_matched: fallbackHasStructuralLaborPattern,
        structural_labor_pattern_reasons: fallbackStructuralLaborPattern.reasons,
        promotion_threshold: selfEmployment.matched ? SELF_EMPLOYMENT_SCORE_THRESHOLD : EMPLOYMENT_SCORE_THRESHOLD,
        promoted_low_confidence: fallbackPromotedLowConfidence,
      },
      raw_block_index: 0,
      split_from_parent: false,
      split_reason: ["fallback_extraction"],
      raw_text: String(extraction?.matching_reason || "").trim() || null,
    });
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const entry of extractedEntries) {
    const key = [entry.type || "employment", normalizeText(entry.company_name), entry.start_date || "", entry.end_date || ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  const sortedEntries = deduped.sort((a, b) => {
    const aType = String(a?.type || "employment");
    const bType = String(b?.type || "employment");
    if (aType !== bType) return aType === "employment" ? -1 : 1;
    const aDate = toMonthIndex(a?.end_date || a?.start_date || "") ?? -1;
    const bDate = toMonthIndex(b?.end_date || b?.start_date || "") ?? -1;
    return bDate - aDate;
  });
  const groupedEmploymentEntries = groupAndMergeEmploymentEntries(sortedEntries);
  const debugSummary = {
    total_raw_text_length: rawText.length,
    total_raw_blocks_before_split: rawBlocksBeforeSplit.length,
    total_blocks_after_split: rawBlocks.length,
    total_table_rows_detected: tabularRows.length,
    total_employment: debugEntries.filter((entry) => String(entry?.type || "") === "employment").length,
    total_administrative: debugEntries.filter((entry) => String(entry?.type || "") === "administrative").length,
    total_discarded: debugEntries.filter((entry) => String(entry?.type || "") === "discarded").length,
    total_grouped_employment: groupedEmploymentEntries.length,
  };
  return {
    entries: sortedEntries,
    grouped_employment_entries: groupedEmploymentEntries,
    debug_summary: debugSummary,
    debug_entries: debugEntries,
  };
}

export function extractVidaLaboralEmploymentEntries({ text, extraction, employmentRecords } = {}) {
  return extractVidaLaboralEmploymentEntriesWithDebug({ text, extraction, employmentRecords }).entries;
}

export function normalizeDocumentaryMatchLevel(level) {
  const raw = String(level || "").trim().toLowerCase();
  if (raw === "high" || raw === "medium" || raw === "low" || raw === "inconclusive" || raw === "conflict") return raw;
  return "inconclusive";
}

export function resolveDocumentaryMatchLevel({
  matching,
  processingStatus,
  validationStatus,
  inconsistencyReason,
} = {}) {
  const normalizedProcessingStatus = String(processingStatus || "").trim().toLowerCase();
  const normalizedValidationStatus = String(validationStatus || "").trim().toLowerCase();
  const explicit = normalizeDocumentaryMatchLevel(
    matching?.overall_match_level || matching?.match_level || matching?.level || null
  );

  if (matching?.overall_match_level || matching?.match_level || matching?.level) {
    return explicit;
  }

  if (String(inconsistencyReason || "").trim() || normalizedValidationStatus === "rejected") {
    return "conflict";
  }

  if (!matching || normalizedProcessingStatus === "queued" || normalizedProcessingStatus === "processing") {
    return "inconclusive";
  }

  const score = clamp01(matching?.overall_match_score ?? matching?.final_score ?? matching?.best_match?.score ?? 0);
  if (score >= 0.82) return "high";
  if (score >= 0.6) return "medium";
  if (score >= 0.35) return "low";
  return "inconclusive";
}

function readOutputText(resp) {
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text.trim();
  if (Array.isArray(resp?.output)) {
    for (const item of resp.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const part of item.content) {
        if (part?.type === "output_text" && typeof part?.text === "string" && part.text.trim()) {
          return part.text.trim();
        }
      }
    }
  }
  return "";
}

export function buildEvidenceExtractionPrompt() {
  return [
    "Extrae señales documentales de una evidencia laboral.",
    "No inventes datos. Si falta algo, devuelve null y añade el campo en missing_fields.",
    "Si hay ambigüedad, needs_manual_review=true.",
    "La salida debe ser estrictamente JSON y cumplir el esquema.",
    "Tipo de documento esperado: nómina, contrato, certificado laboral, vida laboral u otro soporte profesional.",
  ].join("\n");
}

export function normalizeDocumentaryExtract(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const out = {
    document_type: obj.document_type ? String(obj.document_type).trim() : null,
    candidate_name: obj.candidate_name ? String(obj.candidate_name).trim() : null,
    company_name: obj.company_name ? String(obj.company_name).trim() : null,
    job_title: obj.job_title ? String(obj.job_title).trim() : null,
    start_date: obj.start_date ? String(obj.start_date).trim() : null,
    end_date: obj.end_date ? String(obj.end_date).trim() : null,
    issue_date: obj.issue_date ? String(obj.issue_date).trim() : null,
    confidence_score: obj.confidence_score == null ? null : clamp01(obj.confidence_score),
    extracted_signals: Array.isArray(obj.extracted_signals)
      ? obj.extracted_signals.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    matching_reason: obj.matching_reason ? String(obj.matching_reason).trim() : null,
    missing_fields: Array.isArray(obj.missing_fields)
      ? obj.missing_fields.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    needs_manual_review: Boolean(obj.needs_manual_review),
    tax_id: obj.tax_id ? String(obj.tax_id).trim() : null,
    employer_identifier: obj.employer_identifier ? String(obj.employer_identifier).trim() : null,
    payroll_month: obj.payroll_month ? String(obj.payroll_month).trim() : null,
    contract_type: obj.contract_type ? String(obj.contract_type).trim() : null,
  };
  if (!out.document_type) out.missing_fields = Array.from(new Set([...out.missing_fields, "document_type"]));
  return out;
}

export function computeDocumentaryMatching({
  extraction,
  employmentRecords,
  candidateName,
  candidateIdentityHash,
  extractedIdentityHash,
  evidenceType,
}) {
  const rows = Array.isArray(employmentRecords) ? employmentRecords : [];
  const normalizedEvidenceType = String(evidenceType || "").trim().toLowerCase();
  const isVidaLaboral = normalizedEvidenceType === "vida_laboral";
  const extractedIdentityValue = compactIdentity(extraction?.tax_id);
  const identityByOfficialId =
    candidateIdentityHash && extractedIdentityHash && extractedIdentityValue
      ? candidateIdentityHash === extractedIdentityHash
      : null;
  const candidateIdentityMatch = compareIdentityFuzzy(extraction?.candidate_name, candidateName);
  const candidateNameScore = candidateIdentityMatch.score;
  const identityMatch =
    identityByOfficialId === true ? "high" : identityByOfficialId === false ? "none" : candidateIdentityMatch.identity_match;
  const identityMatchMultiplier =
    identityMatch === "high" ? 1 : identityMatch === "medium" ? 0.7 : identityMatch === "low" ? 0.2 : 0;
  const identityGatePassed = identityMatch !== "none";
  const identityConfirmedBy = identityByOfficialId === true ? "official_id" : identityGatePassed ? candidateIdentityMatch.mode : null;

  const scored = rows.map((row) => {
    const companyMatch = compareCompanyName(extraction?.company_name, row);
    const companyScore =
      !String(extraction?.company_name || "").trim() && isVidaLaboral
        ? 0.6
        : companyMatch.score;
    const titleSimilarity = tokenSimilarity(extraction?.job_title, row?.position);
    const dateScore = dateCompatibility(extraction?.start_date, extraction?.end_date, row?.start_date, row?.end_date);
    const effectiveTitleScore =
      isVidaLaboral && !String(extraction?.job_title || "").trim() ? 0.5 : titleSimilarity;
    const scoreWeights =
      isVidaLaboral && !String(extraction?.job_title || "").trim()
        ? { company: 0.5, date: 0.5, title: 0 }
        : { company: 0.4, date: 0.35, title: 0.25 };

    const score = clamp01(
      companyScore * scoreWeights.company + dateScore * scoreWeights.date + effectiveTitleScore * scoreWeights.title,
    );
    return {
      employment_record_id: String(row?.id || ""),
      companySimilarity: companyScore,
      company_match_source: companyMatch.source,
      company_matched_value: companyMatch.matched_value,
      titleSimilarity: effectiveTitleScore,
      dateScore,
      candidateScore: candidateNameScore,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || null;

  const extractionConfidence = extraction?.confidence_score == null ? 0.5 : clamp01(extraction.confidence_score);
  const baseFinalScore = best ? clamp01(best.score * 0.85 + extractionConfidence * 0.15) : 0;
  const finalScore = clamp01(baseFinalScore * identityMatchMultiplier);
  const hasNameInconsistency = identityMatch === "none";
  const mismatchFlags = [];
  if (identityByOfficialId === false) mismatchFlags.push("official_identity_mismatch");
  if (hasNameInconsistency && identityByOfficialId !== false) mismatchFlags.push("person_name_mismatch");
  if (best && best.companySimilarity < 0.55) mismatchFlags.push("company_mismatch");
  if (best && best.titleSimilarity < 0.45) mismatchFlags.push("position_mismatch");
  if (best && best.dateScore < 0.35) mismatchFlags.push("date_mismatch");

  const autoLinkEligible = Boolean(
    (identityMatch === "high" || identityMatch === "medium") &&
    best &&
    finalScore >= 0.82 &&
    best.companySimilarity >= (isVidaLaboral ? 0.55 : 0.6) &&
    best.dateScore >= 0.4 &&
    (isVidaLaboral ? true : best.titleSimilarity >= 0.5)
  );
  const autoLink = isVidaLaboral ? false : autoLinkEligible;

  const suggestedReview = Boolean(
    identityMatch === "low" || identityMatch === "none" || (!autoLink && best && finalScore >= (isVidaLaboral ? 0.45 : 0.6))
  );

  const linkState = isVidaLaboral
    ? "reconciliation_required"
    : autoLink
      ? "auto_linked"
      : suggestedReview
        ? "suggested_review"
        : "unlinked";
  const overallMatchLevel = resolveDocumentaryMatchLevel({
    matching: { final_score: finalScore },
    inconsistencyReason: null,
  });

  const supportingMatches =
    isVidaLaboral
      ? scored
          .filter((item) => item.score >= 0.55 && item.companySimilarity >= 0.45 && item.dateScore >= 0.45)
          .map((item) => item.employment_record_id)
      : [];

  return {
    best_match: best,
    candidates: scored,
    final_score: finalScore,
    company_match_score: best?.companySimilarity ?? 0,
    position_match_score: best?.titleSimilarity ?? 0,
    date_match_score: best?.dateScore ?? 0,
    person_match_score: best?.candidateScore ?? candidateNameScore,
    identity_match: identityMatch,
    identity_match_score: candidateNameScore,
    overall_match_score: finalScore,
    overall_match_level: overallMatchLevel,
    identity_gate_passed: identityGatePassed,
    identity_confirmed_by: identityConfirmedBy,
    identity_by_official_id: identityByOfficialId,
    supports_multiple_experiences: supportingMatches.length > 1,
    supporting_employment_record_ids: supportingMatches,
    mismatch_flags: mismatchFlags,
    link_state: linkState,
    auto_link: autoLink,
    needs_manual_review: !autoLink,
    company_match_source: best?.company_match_source || null,
    matching_reason: isVidaLaboral
      ? identityMatch === "high"
        ? "Documento procesado. Identidad consistente y experiencias listas para revisión."
        : identityMatch === "medium"
          ? "Documento procesado. Coincidencia razonable de identidad. Revisa y vincula las experiencias detectadas."
          : identityMatch === "low"
            ? "Documento procesado. No se ha podido verificar completamente la identidad. Revisa los datos."
            : "Documento procesado. Posible conflicto de identidad. Revisa los datos antes de vincular."
      : autoLink
      ? best?.company_match_source === "legal_name"
        ? "Coincidencia alta con esta experiencia. Empresa alineada por razón social."
        : best?.company_match_source === "commercial_name"
          ? "Coincidencia alta con esta experiencia. Empresa alineada por nombre comercial."
          : "Coincidencia alta entre empresa, periodo y puesto."
      : suggestedReview
        ? identityMatch === "low"
          ? "Coincidencia parcial; la identidad requiere revisión manual."
          : identityMatch === "none"
            ? "Posible conflicto de identidad. Revisa los datos antes de validar."
            : "Coincidencia parcial; requiere revisión manual."
        : "Coincidencia insuficiente para autovincular.",
    inconsistency_reason: null,
  };
}

export async function extractDocumentarySignals(params) {
  const {
    fileBuffer,
    fileName,
    mimeType,
    openaiApiKey,
    model = process.env.OPENAI_MODEL_DOCUMENTARY || "gpt-4.1-mini",
    textFallbackExtractor,
  } = params;

  if (!openaiApiKey) throw new Error("missing_openai_api_key");

  let fileId = null;
  let extraction = null;
  let fallbackTextUsed = false;

  try {
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType || "application/octet-stream" });
    form.append("purpose", "user_data");
    form.append("file", blob, fileName || "evidence_document");

    const uploadResp = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: form,
    });

    if (!uploadResp.ok) {
      const msg = await uploadResp.text().catch(() => "");
      throw new Error(`openai_file_upload_failed_${uploadResp.status}:${msg.slice(0, 220)}`);
    }

    const uploadJson = await uploadResp.json();
    fileId = uploadJson?.id ? String(uploadJson.id) : null;
    if (!fileId) throw new Error("openai_missing_file_id");

    const responsesPayload = {
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildEvidenceExtractionPrompt() },
            { type: "input_file", file_id: fileId },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "evidence_document_extract",
          strict: true,
          schema: DOCUMENTARY_EXTRACTION_SCHEMA,
        },
      },
      temperature: 0,
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(responsesPayload),
    });

    if (!resp.ok) {
      const msg = await resp.text().catch(() => "");
      throw new Error(`openai_responses_failed_${resp.status}:${msg.slice(0, 220)}`);
    }

    const respJson = await resp.json();
    const text = readOutputText(respJson);
    if (!text) throw new Error("openai_no_output_text");
    extraction = normalizeDocumentaryExtract(JSON.parse(text));

    return {
      extraction,
      provider: "openai_responses_file_input",
      model,
      fallbackTextUsed,
    };
  } catch (error) {
    const text = typeof textFallbackExtractor === "function"
      ? await textFallbackExtractor(fileBuffer, fileName || "evidence_document").catch(() => "")
      : "";
    if (text && text.trim()) {
      fallbackTextUsed = true;
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: `${buildEvidenceExtractionPrompt()}\n\nTexto extraído:\n${text.slice(0, 120000)}` },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "evidence_document_extract",
              strict: true,
              schema: DOCUMENTARY_EXTRACTION_SCHEMA,
            },
          },
          temperature: 0,
        }),
      });
      if (resp.ok) {
        const respJson = await resp.json();
        const outText = readOutputText(respJson);
        if (outText) {
          extraction = normalizeDocumentaryExtract(JSON.parse(outText));
          return {
            extraction,
            provider: "openai_responses_text_fallback",
            model,
            fallbackTextUsed,
            warning: String(error?.message || error),
          };
        }
      }
    }

    throw error;
  } finally {
    if (fileId) {
      fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${openaiApiKey}` },
      }).catch(() => {});
    }
  }
}
