export function buildVerificationPayload(experience: any) {
  return {
    employment_record_id: experience?.id,
    email: experience?.company_email?.trim()
  }
}
