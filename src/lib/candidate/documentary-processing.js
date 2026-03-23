const normalizeText = (text) => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

export const parseVidaLaboral = (text) => {
  if (!text) return [];
  const rowRegex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\s\S]+?)(?=\s+\d{2}\s+\d{11,12}|\n\d{2}\/\d{2}\/\d{4}|$)/gu;
  const matches = [...text.matchAll(rowRegex)];
  
  return matches.map(match => {
    const [_, startDate, endDate, rawCompany] = match;
    const companyName = rawCompany.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizedName = normalizeText(companyName);
    const adminKeywords = ['DESEMPLEO', 'SITUACION ASIMILADA', 'VACACIONES', 'INACTIVIDAD', 'COTIZACION'];
    const isAdministrative = adminKeywords.some(kw => normalizedName.includes(kw));

    return {
      startDate,
      endDate,
      companyName: companyName.toUpperCase(),
      normalizedName,
      type: isAdministrative ? 'administrative' : 'employment',
      isVerifiable: !isAdministrative && companyName.length > 2
    };
  }).filter(row => row.companyName !== "");
};

function groupAndMergeEmploymentEntries(entries) {
  return Array.isArray(entries) ? entries : [];
}

function extractDocumentarySignals(input) {
  return {
    entries: Array.isArray(input?.entries) ? input.entries : [],
    signals: Array.isArray(input?.signals) ? input.signals : [],
    metadata: input?.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
}

function computeDocumentaryMatching(args) {
  return {
    matchLevel: "none",
    matchedEmploymentRecordId: null,
    candidate: args?.candidate || null,
    evidence: args?.evidence || null,
    confidence: 0,
    reasons: [],
  };
}

function extractVidaLaboralEmploymentEntriesWithDebug(input) {
  return {
    entries: [],
    grouped_employment_entries: [],
    debug_summary: {
      source: "fallback",
      reason: "missing_export",
      inputType: typeof input,
    },
    debug_entries: [],
    debug: {
      source: "fallback",
      reason: "missing_export",
      inputType: typeof input,
    },
  };
}

function extractVidaLaboralMetadata(input) {
  return {
    source: "fallback",
    hasInput: !!input,
  };
}

function resolveDocumentaryMatchLevel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "verified" || normalized === "strong" || normalized === "high") return "high";
  if (normalized === "medium" || normalized === "partial") return "medium";
  if (normalized === "low" || normalized === "weak") return "low";
  return "none";
}

export {
  groupAndMergeEmploymentEntries,
  extractDocumentarySignals,
  computeDocumentaryMatching,
  extractVidaLaboralEmploymentEntriesWithDebug,
  extractVidaLaboralMetadata,
  resolveDocumentaryMatchLevel
};
