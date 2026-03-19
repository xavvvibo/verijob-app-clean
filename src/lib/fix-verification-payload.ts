export function buildVerificationPayload(experience: any, userId: string) {
  return {
    employment_record_id: String(experience?.id ?? "").trim(),
    email: String(experience?.company_email ?? "").trim(),
    requested_by: String(userId ?? "").trim(),
  }
}
