export function getActiveDocumentaryVerificationId(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const firstId = rows[0]?.id;
  return firstId ? String(firstId) : null;
}

export function buildDocumentaryVerificationInsert({
  employmentRecordId,
  userId,
  companyName,
  position,
  nowIso,
  documentaryScope = "experience",
  evidenceType = "otro_documento",
}) {
  return {
    employment_record_id: employmentRecordId || null,
    requested_by: userId,
    verification_type: "employment",
    verification_channel: "documentary",
    status: "reviewing",
    requested_at: nowIso,
    company_name_target: String(companyName || "").trim() || "Empresa",
    request_context: {
      source: "candidate_evidence_upload",
      auto_associated: true,
      documentary_scope: documentaryScope,
      evidence_type: evidenceType,
      position: String(position || "").trim() || null,
    },
  };
}

export function buildEmploymentRecordDocumentaryRequestedUpdate({ verificationRequestId, nowIso }) {
  return {
    verification_status: "reviewing",
    last_verification_request_id: verificationRequestId,
    last_verification_requested_at: nowIso,
  };
}

export function buildEmploymentRecordDocumentaryResolvedUpdate({ verificationRequestId, nowIso }) {
  return {
    verification_status: "verified_document",
    last_verification_request_id: verificationRequestId,
    verification_resolved_at: nowIso,
  };
}

export function buildEmploymentRecordDocumentaryPendingReviewUpdate({ verificationRequestId, nowIso }) {
  return {
    verification_status: "reviewing",
    last_verification_request_id: verificationRequestId,
    last_verification_requested_at: nowIso,
  };
}
