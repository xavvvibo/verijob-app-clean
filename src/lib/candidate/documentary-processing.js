const normalizeText = (text) => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

const normalizeDateToIso = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeCompanyKey = (value) =>
  normalizeText(value)
    .replace(/\b(SL|S L|SA|S A|SLL|SLU|S L U|SOCIEDAD|LIMITADA|ANONIMA)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function textIncludesAdministrativeSignal(value) {
  const normalized = normalizeText(value);
  const adminKeywords = [
    "DESEMPLEO",
    "SITUACION ASIMILADA",
    "VACACIONES",
    "INACTIVIDAD",
    "COTIZACION",
    "PRESTACION",
    "EXCLUSION",
  ];
  return adminKeywords.some((kw) => normalized.includes(kw));
}

export const parseVidaLaboral = (text) => {
  if (!text) return [];
  const rowRegex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\s\S]+?)(?=\s+\d{2}\s+\d{11,12}|\n\d{2}\/\d{2}\/\d{4}|$)/gu;
  const matches = [...text.matchAll(rowRegex)];
  
  return matches.map(match => {
    const [_, startDate, endDate, rawCompany] = match;
    const companyName = rawCompany.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizedName = normalizeText(companyName);
    const isAdministrative = textIncludesAdministrativeSignal(normalizedName);

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
  const rows = Array.isArray(entries) ? entries : [];
  return rows
    .filter((entry) => String(entry?.type || "employment") === "employment")
    .map((entry) => ({
      entry_id: String(entry?.entry_id || ""),
      type: "employment",
      subtype: null,
      self_employment: Boolean(entry?.self_employment),
      company_name: String(entry?.company_name || "").trim() || "Empresa detectada",
      normalized_company_key: String(entry?.normalized_company_key || "").trim() || null,
      start_date: entry?.start_date || null,
      end_date: entry?.end_date || null,
      is_current: Boolean(entry?.is_current),
      confidence: Number(entry?.confidence || 0),
      group_score: Number(entry?.group_score ?? entry?.confidence ?? 0),
      province_prefix: null,
      province_hint: null,
      suggested_match_employment_record_id: entry?.suggested_match_employment_record_id || null,
      linked_employment_record_id: entry?.linked_employment_record_id || null,
      reconciliation_status: entry?.reconciliation_status || "pending",
      reconciliation_choice: entry?.reconciliation_choice || null,
      source_entry_count: Number(entry?.source_entry_count || 1),
      source_entry_ids: Array.isArray(entry?.source_entry_ids) && entry.source_entry_ids.length
        ? entry.source_entry_ids
        : [String(entry?.entry_id || "")].filter(Boolean),
      source_block_indexes: Array.isArray(entry?.source_block_indexes) ? entry.source_block_indexes : [],
      classification_reasons: Array.isArray(entry?.classification_reasons) ? entry.classification_reasons : [],
      concise_summary:
        String(entry?.concise_summary || "").trim() ||
        `${String(entry?.company_name || "").trim() || "Empresa"} · ${String(entry?.start_date || "—")} · ${String(entry?.end_date || "Actualidad")}`,
      raw_text: entry?.raw_text || null,
    }));
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
  const rows = parseVidaLaboral(input?.text || "");
  const employmentRecords = Array.isArray(input?.employmentRecords) ? input.employmentRecords : [];
  const entries = rows.map((row, index) => {
    const startDate = normalizeDateToIso(row.startDate);
    const endDate = normalizeDateToIso(row.endDate);
    const normalizedCompany = normalizeCompanyKey(row.companyName);
    const suggested = employmentRecords.find((record) => {
      const recordCompany = normalizeCompanyKey(record?.company_name || record?.company_name_freeform || "");
      if (!recordCompany || !normalizedCompany) return false;
      if (recordCompany !== normalizedCompany) return false;
      const recordStart = String(record?.start_date || "").slice(0, 10);
      const recordEnd = String(record?.end_date || "").slice(0, 10);
      return (!startDate || !recordStart || startDate === recordStart) && (!endDate || !recordEnd || endDate === recordEnd);
    }) || null;

    const entryId = `vida-laboral-${index + 1}`;
    return {
      entry_id: entryId,
      type: row.type,
      company_name: row.companyName,
      position: row.type === "employment" ? "Experiencia detectada en vida laboral" : null,
      start_date: startDate,
      end_date: endDate,
      is_current: false,
      confidence: row.type === "employment" ? 0.92 : 0.25,
      group_score: row.type === "employment" ? 0.92 : 0.25,
      ignored_reason: row.type === "employment" ? null : "administrative_row",
      suggested_match_employment_record_id: suggested?.id ? String(suggested.id) : null,
      linked_employment_record_id: null,
      reconciliation_status: row.type === "employment" ? "pending" : "ignored",
      reconciliation_choice: row.type === "employment" ? null : "ignore",
      normalized_company_key: normalizedCompany || null,
      source_entry_count: 1,
      source_entry_ids: [entryId],
      source_block_indexes: [index],
      classification_reasons: row.type === "employment" ? ["vida_laboral_row_detected"] : ["administrative_row"],
      concise_summary: `${row.companyName} · ${startDate || "—"} · ${endDate || "Actualidad"}`,
      raw_text: row.companyName,
      self_employment: false,
    };
  });

  return {
    entries,
    grouped_employment_entries: groupAndMergeEmploymentEntries(entries),
    debug_summary: {
      source: "vida_laboral_regex",
      parsed_rows: rows.length,
      employment_rows: entries.filter((entry) => entry.type === "employment").length,
      administrative_rows: entries.filter((entry) => entry.type === "administrative").length,
    },
    debug_entries: entries,
    debug: {
      source: "vida_laboral_regex",
      parsed_rows: rows.length,
    },
  };
}

function extractVidaLaboralMetadata(input) {
  const text = String(input || "");
  const ceaMatch = text.match(/(?:C\.?E\.?A\.?|CODIGO ELECTRONICO DE AUTENTICIDAD)[\\s:.-]*([A-Z0-9-]{6,})/i);
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  return {
    source: "vida_laboral_regex",
    hasInput: !!input,
    cea_present: Boolean(ceaMatch),
    cea_code: ceaMatch?.[1] || null,
    cea_id: ceaMatch?.[1] || null,
    cea_date: dateMatch ? normalizeDateToIso(dateMatch[1]) : null,
    cea_extraction_confidence: ceaMatch ? 0.92 : 0.35,
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
