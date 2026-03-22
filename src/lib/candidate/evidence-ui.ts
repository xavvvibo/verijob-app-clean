import {
  getEvidenceTrustImpact,
  getEvidenceTypeLabel,
  normalizeEvidenceType,
  toEvidenceUiStatusWithReason,
} from "@/lib/candidate/evidence-types";
import { resolveDocumentaryMatchLevel } from "@/lib/candidate/documentary-processing";

export type CandidateEvidenceUiItem = {
  id: string;
  evidence_id: string;
  verification_request_id: string | null;
  employment_record_id: string | null;
  document_name: string;
  document_type: string;
  evidence_type_key: string;
  experience: string;
  dates: string | null;
  status: string;
  reason: string | null;
  created_at: string | null;
  scope_label: string;
  processing_status: string;
  analysis_completed: boolean;
  processing_label: string;
  trust_label: string | null;
  trust_impact: string;
  match_level: string;
  match_label: string;
  match_summary: string | null;
  person_check_label: string;
  company_check_label: string;
  date_check_label: string;
  position_check_label: string;
};

function describeScore(score: number, good: string, partial: string, bad: string) {
  if (score >= 0.75) return good;
  if (score >= 0.4) return partial;
  return bad;
}

export function formatEvidenceDates(start?: string | null, end?: string | null, isCurrent?: boolean | null) {
  if (!start) return null;
  const s = new Date(start).getFullYear();
  const e = isCurrent ? "Actualidad" : end ? new Date(end).getFullYear() : "Actualidad";
  return `${s} — ${e}`;
}

export function buildEvidenceUiItem(r: any): CandidateEvidenceUiItem {
  const vr = Array.isArray(r?.verification_requests) ? r.verification_requests[0] : r?.verification_requests;
  const er = Array.isArray(vr?.employment_records) ? vr.employment_records[0] : vr?.employment_records;
  const processing = vr?.request_context?.documentary_processing || {};
  const evidenceTypeKey = normalizeEvidenceType(r?.document_type || r?.evidence_type);
  const impact = getEvidenceTrustImpact(evidenceTypeKey);
  const ui = toEvidenceUiStatusWithReason({
    validationStatus: r?.validation_status || vr?.status,
    inconsistencyReason: r?.inconsistency_reason || processing?.inconsistency_reason,
    matchingReason: processing?.matching_reason,
    error: processing?.error,
    fallbackReason:
      String(processing?.status || "").toLowerCase() === "queued"
        ? "Evidencia recibida. La estamos analizando."
        : String(processing?.status || "").toLowerCase() === "processing"
          ? "Estamos analizando el documento."
          : null,
  });
  const scope = String(r?.document_scope || vr?.request_context?.documentary_scope || "").toLowerCase();
  const processingStatus = String(processing?.processing_status || processing?.status || "").toLowerCase();
  const analysisCompleted = processingStatus === "processed" || processingStatus === "completed";
  const linkState = String(processing?.link_state || "").toLowerCase();
  const matchLevel = resolveDocumentaryMatchLevel({
    matching: processing?.matching || {
      overall_match_level: processing?.overall_match_level,
      overall_match_score: processing?.overall_match_score,
      final_score: processing?.overall_match_score,
    },
    processingStatus,
    validationStatus: r?.validation_status || vr?.status,
    inconsistencyReason: r?.inconsistency_reason || processing?.inconsistency_reason,
  });
  const processingLabel =
    processingStatus === "queued"
      ? "Archivo recibido. Pendiente de análisis."
      : processingStatus === "processing"
        ? "Documento en análisis."
        : processingStatus === "processed" && linkState === "auto_linked"
          ? "Documento procesado y vinculado automáticamente."
          : processingStatus === "processed"
            ? "Documento procesado. Está pendiente de revisión."
            : processingStatus === "failed"
              ? "No pudimos completar el análisis automático. Queda pendiente de revisión."
              : "Documento registrado.";
  const scopeLabel = scope === "global" ? "Evidencia global" : "Evidencia asociada a una experiencia";
  const matchLabel = !analysisCompleted
    ? null
    : matchLevel === "high"
      ? "Coincidencia alta con esta experiencia"
      : matchLevel === "medium"
        ? "Coincidencia parcial positiva con esta experiencia"
        : matchLevel === "low"
          ? "Coincidencia baja: revisa fechas o puesto"
          : matchLevel === "conflict"
            ? "Coincidencia conflictiva: revisa empresa, puesto o titular"
            : "Coincidencia no concluyente";
  const companyScore = Number(processing?.company_match_score ?? processing?.matching?.company_match_score ?? 0);
  const dateScore = Number(processing?.date_match_score ?? processing?.matching?.date_match_score ?? 0);
  const positionScore = Number(processing?.position_match_score ?? processing?.matching?.position_match_score ?? 0);
  const identityGatePassed =
    Boolean(processing?.identity_gate_passed ?? processing?.matching?.identity_gate_passed) &&
    matchLevel !== "conflict";
  const trustLabel = !analysisCompleted
    ? null
    : matchLevel === "conflict"
      ? "Este documento no aporta confianza por conflicto de identidad."
      : impact === "alta"
        ? "Esta evidencia aporta confianza alta."
        : impact === "media"
          ? "Esta evidencia aporta confianza media."
          : impact === "baja-media"
            ? "Esta evidencia aporta confianza baja-media."
            : "Esta evidencia aporta confianza baja.";

  return {
    id: String(r?.id || ""),
    evidence_id: String(r?.id || ""),
    verification_request_id: String(r?.verification_request_id || vr?.id || "") || null,
    employment_record_id: String(vr?.employment_record_id || er?.id || "") || null,
    document_name: getEvidenceTypeLabel(evidenceTypeKey),
    document_type: getEvidenceTypeLabel(evidenceTypeKey),
    evidence_type_key: evidenceTypeKey,
    experience:
      scope === "global"
        ? "Varias experiencias"
        : [er?.position, er?.company_name_freeform].filter(Boolean).join(" — ") || "Experiencia no vinculada",
    dates: formatEvidenceDates(er?.start_date, er?.end_date, er?.is_current),
    status: ui.status,
    reason: ui.reason || null,
    created_at: r?.created_at || null,
    scope_label: scopeLabel,
    processing_status: processingStatus || "queued",
    analysis_completed: analysisCompleted,
    processing_label: processingLabel,
    trust_label: trustLabel,
    trust_impact: impact,
    match_level: matchLevel,
    match_label: matchLabel,
    match_summary: analysisCompleted
      ? String(processing?.processing_summary || processing?.matching_reason || "").trim() || null
      : null,
    person_check_label: analysisCompleted
      ? identityGatePassed
        ? "Titular del documento coincide con tu perfil"
        : matchLevel === "conflict"
          ? "Conflicto: el titular del documento no coincide"
          : "Titular pendiente de confirmar"
      : "",
    company_check_label: analysisCompleted ? describeScore(
      companyScore,
      "Empresa coincide",
      "Empresa parcialmente compatible",
      "Empresa no coincide"
    ) : "",
    date_check_label: analysisCompleted ? describeScore(
      dateScore,
      "Fechas compatibles",
      "Fechas parcialmente compatibles",
      "Fechas incompatibles"
    ) : "",
    position_check_label: analysisCompleted ? describeScore(
      positionScore,
      "Puesto coincide",
      "Puesto parcialmente compatible",
      "Puesto no coincide"
    ) : "",
  };
}
