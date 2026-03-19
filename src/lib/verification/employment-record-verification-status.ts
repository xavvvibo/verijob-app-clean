export const EMPLOYMENT_RECORD_VERIFICATION_STATUS = {
  UNVERIFIED: "unverified",
  VERIFICATION_REQUESTED: "verification_requested",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const

export type EmploymentRecordVerificationStatus =
  (typeof EMPLOYMENT_RECORD_VERIFICATION_STATUS)[keyof typeof EMPLOYMENT_RECORD_VERIFICATION_STATUS]

export function normalizeEmploymentRecordVerificationStatus(
  value: unknown,
): EmploymentRecordVerificationStatus {
  const status = String(value || "").trim().toLowerCase()

  if (!status) return EMPLOYMENT_RECORD_VERIFICATION_STATUS.UNVERIFIED

  if (
    status === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED ||
    status === "approved" ||
    status === "verified_document" ||
    status === "verified_paid"
  ) {
    return EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED
  }

  if (status === EMPLOYMENT_RECORD_VERIFICATION_STATUS.REJECTED) {
    return EMPLOYMENT_RECORD_VERIFICATION_STATUS.REJECTED
  }

  if (
    status === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFICATION_REQUESTED ||
    status === "pending_company" ||
    status === "reviewing" ||
    status === "requested" ||
    status === "company_registered_pending" ||
    status === "in_review"
  ) {
    return EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFICATION_REQUESTED
  }

  return EMPLOYMENT_RECORD_VERIFICATION_STATUS.UNVERIFIED
}

export function isVerifiedEmploymentRecordStatus(value: unknown) {
  return normalizeEmploymentRecordVerificationStatus(value) === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED
}
