export function buildVerificationPayload(experience: any, userId: string) {
  return {
    employment_record_id: experience?.id,
    email: experience?.company_email?.trim(),
    requested_by: userId
  }
}
