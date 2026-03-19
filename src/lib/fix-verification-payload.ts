type VerificationExperienceInput = {
  id?: string | null
  company_email?: string | null
  company_name?: string | null
  role_title?: string | null
}

export function buildVerificationPayload(
  experience: VerificationExperienceInput | null | undefined,
  userId: string,
  emailOverride?: string | null,
) {
  const email = String(emailOverride ?? experience?.company_email ?? "").trim().toLowerCase()

  return {
    employment_record_id: String(experience?.id ?? "").trim(),
    email,
    requested_by: String(userId ?? "").trim(),
    company_name: String(experience?.company_name ?? "").trim() || null,
    role_title: String(experience?.role_title ?? "").trim() || null,
  }
}
