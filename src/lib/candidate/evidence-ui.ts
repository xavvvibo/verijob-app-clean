export type EvidenceItem = {
  id: string | null;
  evidence_id: string | null;
  verification_request_id: string | null;
  created_at: string | null;
  evidence_type: string | null;
  document_type: string | null;
  document_scope: string | null;
  validation_status: string | null;
  inconsistency_reason: string | null;
  trust_weight: number | null;
  verification_status: string | null;
  verification_requests: any;
  employment_records: any;
  employment_record_id: string | null;
  position: string | null;
  company_name_freeform: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  processing_status: string | null;
  processing_label: string | null;
  analysis_completed: boolean;
  match_level: string | null;
  match_label: string | null;
  match_summary: string | null;
  raw: any;
};

function normalizeProcessingLabel(processingStatus: string | null, validationStatus: string | null, inconsistencyReason: string | null) {
  const p = String(processingStatus || "").trim().toLowerCase();
  const v = String(validationStatus || "").trim().toLowerCase();

  if (p === "queued") return "Documento recibido. Pendiente de análisis automático.";
  if (p === "processing") return "Estamos analizando el documento.";
  if (p === "failed") return "No pudimos completar el análisis automático todavía.";
  if (v === "valid" || v === "validated") return "Documento analizado correctamente.";
  if (v === "invalid" || v === "rejected") {
    return inconsistencyReason
      ? `Documento con incidencias: ${inconsistencyReason}`
      : "Documento con incidencias detectadas.";
  }
  return "Documento recibido.";
}

function normalizeMatchLabel(matchLevel: string | null) {
  const v = String(matchLevel || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "high") return "Coincidencia alta";
  if (v === "medium") return "Coincidencia media";
  if (v === "low") return "Coincidencia baja";
  if (v === "inconclusive") return "Coincidencia no concluyente";
  return matchLevel;
}

export function buildEvidenceUiItem(input: any): EvidenceItem {
  const row = input || {};
  const verification =
    row.verification_requests ||
    row.verification_request ||
    null;

  const employment =
    row.employment_records ||
    verification?.employment_records ||
    null;

  const documentaryProcessing =
    verification?.request_context?.documentary_processing &&
    typeof verification.request_context.documentary_processing === "object"
      ? verification.request_context.documentary_processing
      : {};

  const validationStatus =
    row.validation_status ??
    row.status ??
    verification?.status ??
    employment?.verification_status ??
    null;

  const processingStatus =
    documentaryProcessing?.processing_status ??
    documentaryProcessing?.status ??
    null;

  const inconsistencyReason =
    row.inconsistency_reason ??
    documentaryProcessing?.error ??
    documentaryProcessing?.processing_summary ??
    null;

  const matchLevel =
    documentaryProcessing?.overall_match_level ??
    documentaryProcessing?.match_level ??
    null;

  const matchSummary =
    documentaryProcessing?.processing_summary ??
    documentaryProcessing?.summary ??
    null;

  const evidenceId = row.id != null ? String(row.id) : null;

  return {
    id: evidenceId,
    evidence_id: evidenceId,
    verification_request_id: row.verification_request_id ?? verification?.id ?? null,
    created_at: row.created_at ?? null,
    evidence_type: row.evidence_type ?? null,
    document_type: row.document_type ?? null,
    document_scope: row.document_scope ?? null,
    validation_status: validationStatus,
    inconsistency_reason: inconsistencyReason,
    trust_weight:
      typeof row.trust_weight === "number"
        ? row.trust_weight
        : row.trust_weight != null
          ? Number(row.trust_weight) || null
          : null,
    verification_status: employment?.verification_status ?? verification?.status ?? null,
    verification_requests: verification,
    employment_records: employment,
    employment_record_id:
      row.employment_record_id ??
      verification?.employment_record_id ??
      employment?.id ??
      null,
    position: employment?.position ?? null,
    company_name_freeform: employment?.company_name_freeform ?? null,
    start_date: employment?.start_date ?? null,
    end_date: employment?.end_date ?? null,
    is_current:
      typeof employment?.is_current === "boolean"
        ? employment.is_current
        : employment?.is_current != null
          ? Boolean(employment.is_current)
          : null,
    storage_path: row.storage_path ?? null,
    file_name: row.file_name ?? row.filename ?? null,
    mime_type: row.mime_type ?? null,
    file_size:
      typeof row.file_size === "number"
        ? row.file_size
        : row.file_size != null
          ? Number(row.file_size) || null
          : null,
    processing_status: processingStatus,
    processing_label: normalizeProcessingLabel(processingStatus, validationStatus, inconsistencyReason),
    analysis_completed: ["succeeded", "completed", "done", "failed"].includes(String(processingStatus || "").trim().toLowerCase()),
    match_level: matchLevel,
    match_label: normalizeMatchLabel(matchLevel),
    match_summary: matchSummary,
    raw: row,
  };
}
