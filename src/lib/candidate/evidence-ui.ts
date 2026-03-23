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
  supports_multiple_experiences: boolean;
  supporting_employment_record_ids: string[];
  supporting_experiences_label: string | null;
  identity_status_label: string | null;
  extracted_employment_entries: Array<{
    entry_id: string;
    type: string;
    company_name: string;
    position: string | null;
    start_date: string | null;
    end_date: string | null;
    confidence: number;
    ignored_reason: string | null;
    suggested_match_employment_record_id: string | null;
    linked_employment_record_id: string | null;
    reconciliation_status: string;
    reconciliation_choice: string | null;
    raw_text: string | null;
  }>;
  grouped_employment_entries: Array<{
    entry_id: string;
    type: string;
    subtype: string | null;
    self_employment: boolean;
    company_name: string;
    normalized_company_key: string | null;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
    confidence: number;
    group_score: number;
    province_prefix: string | null;
    province_hint: string | null;
    suggested_match_employment_record_id: string | null;
    linked_employment_record_id: string | null;
    reconciliation_status: string;
    reconciliation_choice: string | null;
    source_entry_count: number;
    source_entry_ids: string[];
    source_block_indexes: number[];
    classification_reasons: string[];
    concise_summary: string | null;
    raw_text: string | null;
  }>;
  reconciliation_summary: {
    linked_existing_count: number;
    created_count: number;
    ignored_count: number;
    auto_ignored_count: number;
    pending_count: number;
    material_changes: boolean;
    linked_employment_record_ids: string[];
    created_profile_experience_ids: string[];
    auto_verified_count: number;
    auto_verified_employment_record_ids: string[];
    message: string;
  } | null;
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
  const identityConfirmedBy = String(processing?.identity_confirmed_by || processing?.matching?.identity_confirmed_by || "").trim().toLowerCase();
  const companyMatchSource = String(processing?.company_match_source || processing?.matching?.company_match_source || "").trim().toLowerCase();
  const supportingEmploymentRecordIds = Array.isArray(
    processing?.supporting_employment_record_ids || processing?.matching?.supporting_employment_record_ids
  )
    ? (processing?.supporting_employment_record_ids || processing?.matching?.supporting_employment_record_ids)
        .map((value: any) => String(value || "").trim())
        .filter(Boolean)
    : [];
  const supportsMultipleExperiences =
    Boolean(processing?.supports_multiple_experiences || processing?.matching?.supports_multiple_experiences) ||
    supportingEmploymentRecordIds.length > 1;
  const extractedEmploymentEntries = Array.isArray(processing?.extracted_employment_entries)
      ? processing.extracted_employment_entries.map((entry: any) => ({
        entry_id: String(entry?.entry_id || "").trim(),
        type: String(entry?.type || "employment").trim() || "employment",
        company_name: String(entry?.company_name || "").trim() || "Empresa detectada",
        position: String(entry?.position || "").trim() || null,
        start_date: String(entry?.start_date || "").trim() || null,
        end_date: String(entry?.end_date || "").trim() || null,
        confidence: Number(entry?.confidence || 0),
        ignored_reason: String(entry?.ignored_reason || "").trim() || null,
        suggested_match_employment_record_id:
          String(entry?.suggested_match_employment_record_id || "").trim() || null,
        linked_employment_record_id: String(entry?.linked_employment_record_id || "").trim() || null,
        reconciliation_status: String(entry?.reconciliation_status || "pending").trim(),
        reconciliation_choice: String(entry?.reconciliation_choice || "").trim() || null,
        raw_text: String(entry?.raw_text || "").trim() || null,
      }))
    : [];
  const groupedEmploymentEntries = Array.isArray(processing?.grouped_employment_entries)
    ? processing.grouped_employment_entries.map((entry: any) => ({
        entry_id: String(entry?.entry_id || "").trim(),
        type: String(entry?.type || "employment").trim() || "employment",
        subtype: String(entry?.subtype || "").trim() || null,
        self_employment: Boolean(entry?.self_employment),
        company_name: String(entry?.company_name || "").trim() || "Empresa detectada",
        normalized_company_key: String(entry?.normalized_company_key || "").trim() || null,
        start_date: String(entry?.start_date || "").trim() || null,
        end_date: String(entry?.end_date || "").trim() || null,
        is_current: Boolean(entry?.is_current),
        confidence: Number(entry?.confidence || 0),
        group_score: Number(entry?.group_score || entry?.confidence || 0),
        province_prefix: String(entry?.province_prefix || "").trim() || null,
        province_hint: String(entry?.province_hint || "").trim() || null,
        suggested_match_employment_record_id:
          String(entry?.suggested_match_employment_record_id || "").trim() || null,
        linked_employment_record_id: String(entry?.linked_employment_record_id || "").trim() || null,
        reconciliation_status: String(entry?.reconciliation_status || "pending").trim(),
        reconciliation_choice: String(entry?.reconciliation_choice || "").trim() || null,
        source_entry_count: Number(entry?.source_entry_count || 0),
        source_entry_ids: Array.isArray(entry?.source_entry_ids)
          ? entry.source_entry_ids.map((value: any) => String(value || "").trim()).filter(Boolean)
          : [],
        source_block_indexes: Array.isArray(entry?.source_block_indexes)
          ? entry.source_block_indexes.map((value: any) => Number(value)).filter((value: number) => Number.isFinite(value))
          : [],
        classification_reasons: Array.isArray(entry?.classification_reasons)
          ? entry.classification_reasons.map((value: any) => String(value || "").trim()).filter(Boolean)
          : [],
        concise_summary: String(entry?.concise_summary || "").trim() || null,
        raw_text: String(entry?.raw_text || "").trim() || null,
      }))
    : [];
  const reconciliationSummary =
    processing?.reconciliation_summary && typeof processing.reconciliation_summary === "object"
      ? {
          linked_existing_count: Number(processing.reconciliation_summary.linked_existing_count || 0),
          created_count: Number(processing.reconciliation_summary.created_count || 0),
          ignored_count: Number(processing.reconciliation_summary.ignored_count || 0),
          auto_ignored_count: Number(processing.reconciliation_summary.auto_ignored_count || 0),
          pending_count: Number(processing.reconciliation_summary.pending_count || 0),
          material_changes: Boolean(processing.reconciliation_summary.material_changes),
          linked_employment_record_ids: Array.isArray(processing.reconciliation_summary.linked_employment_record_ids)
            ? processing.reconciliation_summary.linked_employment_record_ids.map((value: any) => String(value || "")).filter(Boolean)
            : [],
          created_profile_experience_ids: Array.isArray(processing.reconciliation_summary.created_profile_experience_ids)
            ? processing.reconciliation_summary.created_profile_experience_ids.map((value: any) => String(value || "")).filter(Boolean)
            : [],
          auto_verified_count: Number(processing.reconciliation_summary.auto_verified_count || 0),
          auto_verified_employment_record_ids: Array.isArray(processing.reconciliation_summary.auto_verified_employment_record_ids)
            ? processing.reconciliation_summary.auto_verified_employment_record_ids.map((value: any) => String(value || "")).filter(Boolean)
            : [],
          message: String(processing.reconciliation_summary.message || "").trim(),
        }
      : null;
  const reconciliationResolved = Boolean(reconciliationSummary?.material_changes);
  const identityGatePassed =
    Boolean(processing?.identity_gate_passed ?? processing?.matching?.identity_gate_passed) &&
    matchLevel !== "conflict";
  const identityMatch = String(
    processing?.identity_match || processing?.matching?.identity_match || (identityGatePassed ? "medium" : "none"),
  )
    .trim()
    .toLowerCase();
  const isVidaLaboral = evidenceTypeKey === "vida_laboral";
  const trustLabel = !analysisCompleted
    ? null
    : identityMatch === "high"
      ? isVidaLaboral
        ? "Documento procesado. Aporta confianza alta y ya puedes revisar las experiencias detectadas."
        : "Esta evidencia aporta confianza alta."
      : identityMatch === "medium"
        ? isVidaLaboral
          ? "Documento procesado. Coincidencia razonable y listo para revisión."
          : "Esta evidencia aporta confianza media."
      : identityMatch === "low"
        ? "No se ha podido verificar completamente la identidad. Revisa los datos."
      : identityMatch === "none"
        ? "Posible conflicto de identidad. Revisa los datos antes de validar el documento."
      : isVidaLaboral
        ? "Documento procesado. Revisa y vincula las experiencias detectadas."
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
    supports_multiple_experiences: supportsMultipleExperiences,
    supporting_employment_record_ids: supportingEmploymentRecordIds,
    supporting_experiences_label:
      analysisCompleted && isVidaLaboral && (groupedEmploymentEntries.length > 0 || extractedEmploymentEntries.length > 0)
        ? `Se han detectado ${(groupedEmploymentEntries.length > 0 ? groupedEmploymentEntries : extractedEmploymentEntries).filter((entry) => String(entry?.type || "").trim() === "employment").length} experiencias laborales para revisar y vincular.`
        : analysisCompleted && supportsMultipleExperiences
          ? `Este documento puede reforzar ${supportingEmploymentRecordIds.length} experiencias compatibles del perfil.`
          : null,
    identity_status_label: analysisCompleted
      ? isVidaLaboral && reconciliationResolved
        ? reconciliationSummary?.auto_verified_count
          ? "Conciliación completada. Las experiencias vinculadas han quedado verificadas por documento."
          : "Conciliación guardada. Las experiencias vinculadas ya están resueltas en tu perfil."
        : identityMatch === "high"
        ? identityConfirmedBy === "official_id"
          ? "Identidad consistente. Confirmada por identificador oficial."
          : "Identidad consistente. Coincidencia alta con tu perfil."
        : identityMatch === "medium"
          ? "Coincidencia razonable de identidad con tu perfil."
          : identityMatch === "low"
            ? "No se ha podido verificar completamente la identidad. Revisa los datos."
            : "Posible conflicto de identidad. Revisa los datos."
      : null,
    extracted_employment_entries: extractedEmploymentEntries,
    grouped_employment_entries: groupedEmploymentEntries,
    reconciliation_summary: reconciliationSummary,
    person_check_label: analysisCompleted
      ? isVidaLaboral
        ? ""
        : identityMatch === "high"
        ? identityConfirmedBy === "official_id"
          ? "Identidad confirmada por documento"
          : identityConfirmedBy === "name_subset_match" || identityConfirmedBy === "name_tolerant_match"
            ? "Coincidencia alta pese a variación en el nombre mostrado"
            : "Titular del documento coincide con tu perfil"
        : identityMatch === "medium"
          ? "Coincidencia razonable del titular con tu perfil"
          : identityMatch === "low"
            ? "Revisar identidad del titular"
            : "Posible conflicto de identidad"
      : "",
    company_check_label: analysisCompleted && !isVidaLaboral ? describeScore(
      companyScore,
      companyMatchSource === "legal_name" ? "Empresa coincidente por razón social" : companyMatchSource === "commercial_name" ? "Empresa coincidente por nombre comercial" : "Empresa coincide",
      companyMatchSource === "legal_name" ? "Empresa parcialmente compatible por razón social" : companyMatchSource === "commercial_name" ? "Empresa parcialmente compatible por nombre comercial" : "Empresa parcialmente compatible",
      "Empresa no coincide"
    ) : "",
    date_check_label: analysisCompleted && !isVidaLaboral ? describeScore(
      dateScore,
      "Fechas compatibles",
      "Fechas parcialmente compatibles",
      "Fechas incompatibles"
    ) : "",
    position_check_label: analysisCompleted && !isVidaLaboral ? describeScore(
      positionScore,
      "Puesto coincide",
      "Puesto parcialmente compatible",
      "Puesto no coincide"
    ) : "",
  };
}
