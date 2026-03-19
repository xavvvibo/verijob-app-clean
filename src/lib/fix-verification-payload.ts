type VerificationExperienceInput = {
  id?: string | null
  profile_experience_id?: string | null
  employment_record_id?: string | null
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
  const profileExperienceId = String(experience?.profile_experience_id ?? experience?.id ?? "").trim()
  const employmentRecordId = String(experience?.employment_record_id ?? "").trim()

  return {
    employment_record_id: employmentRecordId,
    profile_experience_id: profileExperienceId,
    email,
    requested_by: String(userId ?? "").trim(),
    company_name: String(experience?.company_name ?? "").trim() || null,
    role_title: String(experience?.role_title ?? "").trim() || null,
  }
}
