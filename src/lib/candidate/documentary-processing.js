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

function textTokens(v) {
  return normalizeText(v)
    .split(" ")
    .filter((x) => x.length > 2);
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

export function computeDocumentaryMatching({ extraction, employmentRecords, candidateName }) {
  const rows = Array.isArray(employmentRecords) ? employmentRecords : [];
  const scored = rows.map((row) => {
    const companySimilarity = tokenSimilarity(extraction?.company_name, row?.company_name_freeform);
    const titleSimilarity = tokenSimilarity(extraction?.job_title, row?.position);
    const dateScore = dateCompatibility(extraction?.start_date, extraction?.end_date, row?.start_date, row?.end_date);
    const candidateScore = extraction?.candidate_name
      ? tokenSimilarity(extraction?.candidate_name, candidateName)
      : 0.5;

    const score = clamp01(companySimilarity * 0.4 + titleSimilarity * 0.2 + dateScore * 0.25 + candidateScore * 0.15);
    return {
      employment_record_id: String(row?.id || ""),
      companySimilarity,
      titleSimilarity,
      dateScore,
      candidateScore,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || null;

  const extractionConfidence = extraction?.confidence_score == null ? 0.5 : clamp01(extraction.confidence_score);
  const finalScore = best ? clamp01(best.score * 0.75 + extractionConfidence * 0.25) : 0;

  const autoLink = Boolean(
    best &&
      finalScore >= 0.82 &&
      best.companySimilarity >= 0.6 &&
      (best.dateScore >= 0.4 || best.titleSimilarity >= 0.5)
  );

  const suggestedReview = Boolean(!autoLink && best && finalScore >= 0.6);

  const linkState = autoLink ? "auto_linked" : suggestedReview ? "suggested_review" : "unlinked";

  return {
    best_match: best,
    candidates: scored,
    final_score: finalScore,
    link_state: linkState,
    auto_link: autoLink,
    needs_manual_review: !autoLink,
    matching_reason: autoLink
      ? "Coincidencia alta entre empresa, periodo y puesto"
      : suggestedReview
        ? "Coincidencia parcial; requiere revisión manual"
        : "Coincidencia insuficiente para autovincular",
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
