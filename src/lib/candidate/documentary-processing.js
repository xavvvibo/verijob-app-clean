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
  const extractedIdentityValue = compactIdentity(extraction?.tax_id);
  const identityByOfficialId =
    candidateIdentityHash && extractedIdentityHash && extractedIdentityValue
      ? candidateIdentityHash === extractedIdentityHash
      : null;
  const candidateNameMatch = comparePersonName(extraction?.candidate_name, candidateName);
  const candidateNameScore = candidateNameMatch.score;
  const hardIdentityConflict =
    identityByOfficialId === false || (String(extraction?.candidate_name || "").trim() && candidateNameMatch.level === "conflict");
  const identityGatePassed =
    identityByOfficialId === true || candidateNameMatch.level === "high" || candidateNameMatch.level === "medium";
  const identityConfirmedBy = identityByOfficialId === true ? "official_id" : identityGatePassed ? candidateNameMatch.mode : null;

  const scored = rows.map((row) => {
    const companyMatch = compareCompanyName(extraction?.company_name, row);
    const companyScore =
      !String(extraction?.company_name || "").trim() && String(evidenceType || "").trim().toLowerCase() === "vida_laboral"
        ? 0.6
        : companyMatch.score;
    const titleSimilarity = tokenSimilarity(extraction?.job_title, row?.position);
    const dateScore = dateCompatibility(extraction?.start_date, extraction?.end_date, row?.start_date, row?.end_date);

    const score = identityGatePassed
      ? clamp01(companyScore * 0.4 + dateScore * 0.35 + titleSimilarity * 0.25)
      : hardIdentityConflict
        ? 0
        : clamp01(companyScore * 0.2 + dateScore * 0.5 + titleSimilarity * 0.15);
    return {
      employment_record_id: String(row?.id || ""),
      companySimilarity: companyScore,
      company_match_source: companyMatch.source,
      company_matched_value: companyMatch.matched_value,
      titleSimilarity,
      dateScore,
      candidateScore: candidateNameScore,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || null;

  const extractionConfidence = extraction?.confidence_score == null ? 0.5 : clamp01(extraction.confidence_score);
  const finalScore = hardIdentityConflict ? 0 : best ? clamp01(best.score * 0.85 + extractionConfidence * 0.15) : 0;
  const hasNameInconsistency = Boolean(hardIdentityConflict);
  const mismatchFlags = [];
  if (identityByOfficialId === false) mismatchFlags.push("official_identity_mismatch");
  if (hasNameInconsistency && identityByOfficialId !== false) mismatchFlags.push("person_name_mismatch");
  if (best && best.companySimilarity < 0.55) mismatchFlags.push("company_mismatch");
  if (best && best.titleSimilarity < 0.45) mismatchFlags.push("position_mismatch");
  if (best && best.dateScore < 0.35) mismatchFlags.push("date_mismatch");

  const autoLink = Boolean(
    identityGatePassed &&
    best &&
    finalScore >= 0.82 &&
    best.companySimilarity >= 0.6 &&
    best.dateScore >= 0.4 &&
    best.titleSimilarity >= 0.5
  );

  const suggestedReview = Boolean(hasNameInconsistency || (!autoLink && best && finalScore >= 0.6));

  const linkState = autoLink ? "auto_linked" : suggestedReview ? "suggested_review" : "unlinked";
  const overallMatchLevel = hardIdentityConflict
    ? "conflict"
    : !identityGatePassed && String(extraction?.candidate_name || "").trim()
      ? "inconclusive"
    : resolveDocumentaryMatchLevel({
        matching: { final_score: finalScore },
        inconsistencyReason: null,
      });

  const supportingMatches =
    String(evidenceType || "").trim().toLowerCase() === "vida_laboral"
      ? scored.filter((item) => item.score >= 0.55).map((item) => item.employment_record_id)
      : [];

  return {
    best_match: best,
    candidates: scored,
    final_score: finalScore,
    company_match_score: best?.companySimilarity ?? 0,
    position_match_score: best?.titleSimilarity ?? 0,
    date_match_score: best?.dateScore ?? 0,
    person_match_score: best?.candidateScore ?? candidateNameScore,
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
    matching_reason: autoLink
      ? best?.company_match_source === "legal_name"
        ? "Coincidencia alta con esta experiencia. Empresa alineada por razón social."
        : best?.company_match_source === "commercial_name"
          ? "Coincidencia alta con esta experiencia. Empresa alineada por nombre comercial."
          : "Coincidencia alta entre empresa, periodo y puesto."
      : suggestedReview
        ? hardIdentityConflict
          ? identityByOfficialId === false
            ? "Conflicto: el identificador oficial del documento no coincide con el candidato."
            : "Conflicto: el titular del documento no coincide razonablemente con el candidato."
          : "Coincidencia parcial; requiere revisión manual."
        : "Coincidencia insuficiente para autovincular.",
    inconsistency_reason: hardIdentityConflict
      ? identityByOfficialId === false
        ? "Conflicto: el identificador oficial del documento no coincide con el candidato."
        : "Conflicto: el titular del documento no coincide razonablemente con el candidato."
      : null,
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
