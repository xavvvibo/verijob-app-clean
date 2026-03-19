import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"
import { createPagesRouteClient } from "@/utils/supabase/pages"
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution"

async function getTableColumns(supabase: any, tableName: string) {
  try {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName)

    if (error || !Array.isArray(data)) return new Set<string>()
    return new Set(data.map((row: any) => String(row?.column_name || "").trim()).filter(Boolean))
  } catch {
    return new Set<string>()
  }
}

function norm(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

function experienceMatchKey(input: any) {
  return [
    norm(input?.role_title ?? input?.position),
    norm(input?.company_name ?? input?.company_name_freeform),
    norm(input?.start_date),
    norm(input?.end_date),
  ].join("|")
}

async function resolveEmploymentRecordId(params: {
  admin: any
  candidateId: string
  employmentRecordId?: string
  profileExperienceId?: string
}) {
  const candidateId = String(params.candidateId || "").trim()
  const directEmploymentRecordId = String(params.employmentRecordId || "").trim()
  const profileExperienceId = String(params.profileExperienceId || "").trim()

  if (directEmploymentRecordId) {
    const { data: employment } = await params.admin
      .from("employment_records")
      .select("id,candidate_id")
      .eq("id", directEmploymentRecordId)
      .maybeSingle()

    if (employment && String((employment as any)?.candidate_id || "") === candidateId) {
      return { employmentRecordId: String((employment as any).id), profileExperienceId }
    }
  }

  if (!profileExperienceId) {
    return { employmentRecordId: "", profileExperienceId: "" }
  }

  const { data: profileExperience, error: profileExperienceError } = await params.admin
    .from("profile_experiences")
    .select("id,user_id,role_title,company_name,start_date,end_date")
    .eq("id", profileExperienceId)
    .eq("user_id", candidateId)
    .maybeSingle()

  if (profileExperienceError || !profileExperience) {
    return { employmentRecordId: "", profileExperienceId }
  }

  const employmentColumns = await getTableColumns(params.admin, "employment_records")
  const selectColumns = ["id", "candidate_id", "position", "company_name_freeform", "start_date", "end_date"]
  if (employmentColumns.has("source_experience_id")) selectColumns.push("source_experience_id")

  const { data: employmentRows } = await params.admin
    .from("employment_records")
    .select(selectColumns.join(","))
    .eq("candidate_id", candidateId)

  const profileExperienceKey = experienceMatchKey(profileExperience)
  const existingEmployment = (Array.isArray(employmentRows) ? employmentRows : []).find((row: any) => {
    if (employmentColumns.has("source_experience_id") && String((row as any)?.source_experience_id || "") === profileExperienceId) {
      return true
    }
    return experienceMatchKey(row) === profileExperienceKey
  })

  if (existingEmployment?.id) {
    return { employmentRecordId: String(existingEmployment.id), profileExperienceId }
  }

  const nowIso = new Date().toISOString()
  const insertPayload: Record<string, any> = {
    candidate_id: candidateId,
    position: (profileExperience as any)?.role_title || null,
    company_name_freeform: (profileExperience as any)?.company_name || null,
    start_date: (profileExperience as any)?.start_date || null,
    end_date: (profileExperience as any)?.end_date || null,
  }
  if (employmentColumns.has("source_experience_id")) insertPayload.source_experience_id = profileExperienceId
  if (employmentColumns.has("verification_status")) insertPayload.verification_status = "requested"
  if (employmentColumns.has("last_verification_requested_at")) insertPayload.last_verification_requested_at = nowIso
  if (employmentColumns.has("is_current")) insertPayload.is_current = !(profileExperience as any)?.end_date
  if (employmentColumns.has("company_id")) insertPayload.company_id = null

  const { data: createdEmployment, error: createdEmploymentError } = await params.admin
    .from("employment_records")
    .insert(insertPayload)
    .select("id")
    .single()

  if (createdEmploymentError || !createdEmployment?.id) {
    return { employmentRecordId: "", profileExperienceId }
  }

  return { employmentRecordId: String(createdEmployment.id), profileExperienceId }
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" })
  }

  try {
    const authClient = createPagesRouteClient(req, res)
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      return res.status(401).json({
        error: "unauthorized",
        diagnostic_code: "no_user",
      })
    }

    const {
      employment_record_id,
      profile_experience_id,
      email,
      requested_by,
      company_name,
      role_title,
    } = req.body ?? {}

    const requestedEmploymentRecordId = String(employment_record_id ?? "").trim()
    const normalizedProfileExperienceId = String(profile_experience_id ?? "").trim()
    const normalizedEmail = String(email ?? "").trim().toLowerCase()
    const normalizedRequestedBy = String(requested_by ?? user.id ?? "").trim()
    const normalizedCompanyName = String(company_name ?? "").trim() || null
    const normalizedRoleTitle = String(role_title ?? "").trim() || null

    if (!normalizedEmail) {
      return res.status(400).json({ error: "missing_email" })
    }

    if (normalizedRequestedBy !== user.id) {
      return res.status(403).json({ error: "requested_by_mismatch" })
    }

    const admin = createAdminClient()
    const resolvedIds = await resolveEmploymentRecordId({
      admin,
      candidateId: normalizedRequestedBy,
      employmentRecordId: requestedEmploymentRecordId,
      profileExperienceId: normalizedProfileExperienceId,
    })
    const normalizedEmploymentRecordId = String(resolvedIds.employmentRecordId || "").trim()
    const profileExperienceIdForUpdate = String(resolvedIds.profileExperienceId || "").trim()

    if (!normalizedEmploymentRecordId) {
      return res.status(400).json({
        error: "missing_employment_record_id",
        details: "No se ha podido resolver un employment_record válido para esta experiencia.",
      })
    }

    let existingRequest: any = null

    const activeLookup = await admin
      .from("verification_requests")
      .select("id,status,resolved_at,external_resolved")
      .eq("requested_by", normalizedRequestedBy)
      .eq("employment_record_id", normalizedEmploymentRecordId)
      .eq("verification_channel", "email")
      .eq("external_email_target", normalizedEmail)
      .neq("status", "revoked")
      .order("created_at", { ascending: false })
      .limit(5)

    if (activeLookup.error && !isMissingExternalResolvedColumn(activeLookup.error)) {
      return res.status(400).json({
        error: "verification_lookup_failed",
        details: activeLookup.error.message,
      })
    }

    const candidateExistingRows = Array.isArray(activeLookup.data) ? activeLookup.data : []
    existingRequest = candidateExistingRows.find((row: any) => !isVerificationExternallyResolved(row)) || null

    if (existingRequest?.id) {
      if (profileExperienceIdForUpdate) {
        await admin
          .from("profile_experiences")
          .update({ matched_verification_id: existingRequest.id })
          .eq("id", profileExperienceIdForUpdate)
          .eq("user_id", normalizedRequestedBy)
      }

      return res.status(200).json({
        ok: true,
        id: existingRequest.id,
        already_exists: true,
      })
    }

    const insertPayload = {
      employment_record_id: normalizedEmploymentRecordId,
      external_email_target: normalizedEmail,
      verification_channel: "email",
      status: "pending_company",
      requested_by: normalizedRequestedBy,
      company_name_target: normalizedCompanyName,
      request_context: {
        source: "candidate_verification_request",
        company_email: normalizedEmail,
        company_name: normalizedCompanyName,
        role_title: normalizedRoleTitle,
      },
    }

    const { data, error } = await admin
      .from("verification_requests")
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      return res.status(400).json({
        error: "verification_insert_failed",
        details: error.message,
        code: error.code,
      })
    }

    await admin
      .from("employment_records")
      .update({
        last_verification_request_id: data.id,
        verification_status: "requested",
        last_verification_requested_at: new Date().toISOString(),
      })
      .eq("id", normalizedEmploymentRecordId)
      .eq("candidate_id", normalizedRequestedBy)

    if (profileExperienceIdForUpdate) {
      await admin
        .from("profile_experiences")
        .update({ matched_verification_id: data.id })
        .eq("id", profileExperienceIdForUpdate)
        .eq("user_id", normalizedRequestedBy)
    }

    return res.status(200).json({
      ok: true,
      id: data.id,
    })
  } catch (e: any) {
    return res.status(500).json({
      error: "internal_error",
      details: e.message,
    })
  }
}
