import {
  EMPLOYMENT_RECORD_VERIFICATION_STATUS,
  isVerifiedEmploymentRecordStatus,
  normalizeEmploymentRecordVerificationStatus,
} from "@/lib/verification/employment-record-verification-status";

function toText(value: unknown) {
  return String(value || "").trim();
}

function toLower(value: unknown) {
  return toText(value).toLowerCase();
}

function toDateMs(value: unknown) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : 0;
}

function extractDocumentaryAutoVerifiedIds(requestContext: any) {
  const processing =
    requestContext?.documentary_processing && typeof requestContext.documentary_processing === "object"
      ? requestContext.documentary_processing
      : {};
  const rawIds = [
    ...(Array.isArray(processing?.auto_verified_employment_record_ids) ? processing.auto_verified_employment_record_ids : []),
    ...(Array.isArray(processing?.reconciliation_summary?.auto_verified_employment_record_ids)
      ? processing.reconciliation_summary.auto_verified_employment_record_ids
      : []),
  ];
  return Array.from(new Set(rawIds.map((value: any) => toText(value)).filter(Boolean)));
}

function formatExperienceLabel(row: any) {
  const position = toText(row?.position || row?.role_title || "Experiencia");
  const company = toText(row?.company_name_freeform || row?.company_name || "Empresa");
  const start = toText(row?.start_date || "—");
  const end = toText(row?.end_date || "Actualidad");
  return `${position} — ${company} (${start} · ${end})`;
}

function requestSupportsEmploymentRecord(request: any, employmentRecordId: string) {
  if (toText(request?.employment_record_id) === employmentRecordId) return true;
  const requestContext = request?.request_context && typeof request.request_context === "object" ? request.request_context : {};
  return extractDocumentaryAutoVerifiedIds(requestContext).includes(employmentRecordId);
}

export async function collectVerificationAffectedExperiences(args: {
  admin: any;
  verificationId: string;
  candidateId?: string | null;
}) {
  const { admin, verificationId } = args;
  const { data: verification, error: verificationErr } = await admin
    .from("verification_requests")
    .select("id,requested_by,employment_record_id,status,verification_channel,request_context,revoked_at,resolved_at,created_at")
    .eq("id", verificationId)
    .maybeSingle();

  if (verificationErr) {
    return { error: verificationErr, verification: null, affected: [] as any[] };
  }
  if (!verification) {
    return { error: null, verification: null, affected: [] as any[] };
  }

  const candidateId = toText(args.candidateId || verification?.requested_by);
  let resolvedCandidateId = candidateId;
  if (!resolvedCandidateId && verification?.employment_record_id) {
    const { data: employmentCandidate } = await admin
      .from("employment_records")
      .select("candidate_id")
      .eq("id", verification.employment_record_id)
      .maybeSingle();
    resolvedCandidateId = toText(employmentCandidate?.candidate_id);
  }

  if (!resolvedCandidateId) {
    return { error: null, verification, affected: [] as any[] };
  }

  const [{ data: employmentRows }, { data: verificationRows }] = await Promise.all([
    admin
      .from("employment_records")
      .select("id,candidate_id,source_experience_id,position,company_name_freeform,start_date,end_date,verification_status,last_verification_request_id")
      .eq("candidate_id", resolvedCandidateId),
    admin
      .from("verification_requests")
      .select("id,requested_by,employment_record_id,status,verification_channel,request_context,revoked_at,resolved_at,created_at,requested_at")
      .eq("requested_by", resolvedCandidateId),
  ]);

  const allVerifications = Array.isArray(verificationRows) ? verificationRows : [];
  const employmentRecords = Array.isArray(employmentRows) ? employmentRows : [];
  const affectedRows = employmentRecords.filter((row: any) => {
    const recordId = toText(row?.id);
    if (!recordId) return false;
    if (toText(row?.last_verification_request_id) === verificationId) return true;
    return requestSupportsEmploymentRecord(verification, recordId);
  });

  const affected = affectedRows.map((row: any) => {
    const recordId = toText(row?.id);
    const alternativeVerified = allVerifications
      .filter((item: any) => toText(item?.id) !== verificationId)
      .filter((item: any) => !toText(item?.revoked_at))
      .filter((item: any) => toLower(item?.status) === "verified" || toLower(item?.status) === "approved")
      .filter((item: any) => requestSupportsEmploymentRecord(item, recordId))
      .sort((a: any, b: any) => toDateMs(b?.resolved_at || b?.created_at) - toDateMs(a?.resolved_at || a?.created_at))[0] || null;

    const alternativePending = allVerifications
      .filter((item: any) => toText(item?.id) !== verificationId)
      .filter((item: any) => !toText(item?.revoked_at))
      .filter((item: any) => {
        const status = toLower(item?.status);
        return status && status !== "verified" && status !== "approved" && status !== "rejected" && status !== "revoked";
      })
      .filter((item: any) => requestSupportsEmploymentRecord(item, recordId))
      .sort((a: any, b: any) => toDateMs(b?.requested_at || b?.created_at) - toDateMs(a?.requested_at || a?.created_at))[0] || null;

    const currentlyVerified = isVerifiedEmploymentRecordStatus(row?.verification_status);
    const losesVerification =
      currentlyVerified &&
      toText(row?.last_verification_request_id) === verificationId &&
      !alternativeVerified;

    return {
      employment_record_id: recordId,
      profile_experience_id: toText(row?.source_experience_id) || null,
      label: formatExperienceLabel(row),
      current_status: normalizeEmploymentRecordVerificationStatus(row?.verification_status),
      loses_verification: losesVerification,
      keeps_verified_by_alternative: Boolean(alternativeVerified),
      alternative_verified_request_id: toText(alternativeVerified?.id) || null,
      alternative_pending_request_id: toText(alternativePending?.id) || null,
      current_verification_request_id: toText(row?.last_verification_request_id) || null,
    };
  });

  return { error: null, verification, affected };
}

export async function applyVerificationRemovalImpact(args: {
  admin: any;
  verificationId: string;
  candidateId?: string | null;
}) {
  const collected = await collectVerificationAffectedExperiences(args);
  if (collected.error || !collected.verification) {
    return collected;
  }

  await args.admin
    .from("profile_experiences")
    .update({ matched_verification_id: null })
    .eq("matched_verification_id", args.verificationId);

  for (const entry of collected.affected) {
    const employmentRecordId = toText(entry?.employment_record_id);
    if (!employmentRecordId) continue;

    if (entry.keeps_verified_by_alternative && entry.alternative_verified_request_id) {
      const { data: altRequest } = await args.admin
        .from("verification_requests")
        .select("id,resolved_at,created_at")
        .eq("id", entry.alternative_verified_request_id)
        .maybeSingle();

      await args.admin
        .from("employment_records")
        .update({
          verification_status: EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED,
          last_verification_request_id: entry.alternative_verified_request_id,
          verification_resolved_at: altRequest?.resolved_at || altRequest?.created_at || null,
        })
        .eq("id", employmentRecordId);

      if (entry.profile_experience_id) {
        await args.admin
          .from("profile_experiences")
          .update({ matched_verification_id: entry.alternative_verified_request_id })
          .eq("id", entry.profile_experience_id);
      }
      continue;
    }

    if (entry.alternative_pending_request_id) {
      await args.admin
        .from("employment_records")
        .update({
          verification_status: EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFICATION_REQUESTED,
          last_verification_request_id: entry.alternative_pending_request_id,
          verification_result: null,
          verification_resolved_at: null,
        })
        .eq("id", employmentRecordId);

      if (entry.profile_experience_id) {
        await args.admin
          .from("profile_experiences")
          .update({ matched_verification_id: entry.alternative_pending_request_id })
          .eq("id", entry.profile_experience_id);
      }
      continue;
    }

    await args.admin
      .from("employment_records")
      .update({
        verification_status: EMPLOYMENT_RECORD_VERIFICATION_STATUS.UNVERIFIED,
        last_verification_request_id: null,
        verification_result: null,
        verification_resolved_at: null,
      })
      .eq("id", employmentRecordId);
  }

  return collected;
}
