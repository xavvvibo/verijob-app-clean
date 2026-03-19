import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { createPagesRouteClient } from "@/utils/supabase/pages"
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution"
import { markEmploymentRecordVerificationRequested } from "@/lib/verification/employment-record-status"
import { sendTransactionalEmail } from "@/server/email/sendTransactionalEmail"
import { buildExternalExperienceVerificationEmail } from "@/lib/email/templates/externalExperienceVerification"

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

function getAppUrl() {
  return String(process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es").replace(/\/+$/, "")
}

function newExternalToken() {
  return crypto.randomBytes(16).toString("hex")
}

async function ensureVerificationRequestExternalToken(args: {
  admin: any
  verificationRequestId: string
  existingToken?: string | null
  existingExpiresAt?: string | null
}) {
  const existingToken = String(args.existingToken || "").trim()
  const existingExpiresAt = String(args.existingExpiresAt || "").trim()
  if (existingToken) {
    return {
      ok: true as const,
      token: existingToken,
      expiresAt: existingExpiresAt || null,
      updated: false,
      error: null,
    }
  }

  const token = newExternalToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString()
  const { error } = await args.admin
    .from("verification_requests")
    .update({
      external_token: token,
      external_token_expires_at: expiresAt,
    })
    .eq("id", args.verificationRequestId)

  if (error) {
    return {
      ok: false as const,
      token: null,
      expiresAt: null,
      updated: false,
      error,
    }
  }

  return {
    ok: true as const,
    token,
    expiresAt,
    updated: true,
    error: null,
  }
}

async function resolveEmploymentRecordId(params: {
  admin: any
  candidateId: string
  employmentRecordId?: string
  profileExperienceId?: string
}) {
  const candidateId = String(params.candidateId || "").trim()
  const directEmploymentRecordId = String(params.employmentRecordId || "").trim()
  const profileExperienceId = String(params.profileExperienceId || "").trim() || directEmploymentRecordId

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
    return {
      employmentRecordId: "",
      profileExperienceId,
      resolutionError: profileExperienceError?.message || "profile_experience_not_found",
      resolutionStep: "profile_experience_lookup",
    }
  }

  const employmentRowsQuery = await params.admin
    .from("employment_records")
    .select("id,candidate_id,position,company_name_freeform,start_date,end_date,source_experience_id")
    .eq("candidate_id", candidateId)

  const employmentRowsFallback = employmentRowsQuery.error
    ? await params.admin
        .from("employment_records")
        .select("id,candidate_id,position,company_name_freeform,start_date,end_date")
        .eq("candidate_id", candidateId)
    : null

  const employmentRows = Array.isArray(employmentRowsQuery.data)
    ? employmentRowsQuery.data
    : Array.isArray(employmentRowsFallback?.data)
      ? employmentRowsFallback.data
      : []

  const profileExperienceKey = experienceMatchKey(profileExperience)
  const existingEmployment = employmentRows.find((row: any) => {
    if (String((row as any)?.source_experience_id || "") === profileExperienceId) {
      return true
    }
    return experienceMatchKey(row) === profileExperienceKey
  })

  if (existingEmployment?.id) {
    return { employmentRecordId: String(existingEmployment.id), profileExperienceId }
  }

  const insertPayload: Record<string, any> = {
    candidate_id: candidateId,
    position: (profileExperience as any)?.role_title || null,
    company_name_freeform: (profileExperience as any)?.company_name || null,
    start_date: (profileExperience as any)?.start_date || null,
    end_date: (profileExperience as any)?.end_date || null,
    verification_status: "pending_company",
    source_experience_id: profileExperienceId,
  }

  let createdEmployment: any = null
  let createdEmploymentError: any = null
  let attemptedInsertPayload: Record<string, any> = { ...insertPayload }

  const primaryInsert = await params.admin
    .from("employment_records")
    .insert(insertPayload)
    .select("id")
    .single()

  createdEmployment = primaryInsert.data
  createdEmploymentError = primaryInsert.error

  if (
    createdEmploymentError &&
    /source_experience_id/i.test(String(createdEmploymentError?.message || ""))
  ) {
    const fallbackInsertPayload = { ...insertPayload }
    delete fallbackInsertPayload.source_experience_id
    attemptedInsertPayload = fallbackInsertPayload
    const fallbackInsert = await params.admin
      .from("employment_records")
      .insert(fallbackInsertPayload)
      .select("id")
      .single()
    createdEmployment = fallbackInsert.data
    createdEmploymentError = fallbackInsert.error
  }

  if (createdEmploymentError || !createdEmployment?.id) {
    return {
      employmentRecordId: "",
      profileExperienceId,
      resolutionError: createdEmploymentError?.message || "employment_record_insert_failed",
      resolutionStep: "employment_record_insert",
      employmentRecordInsertPayload: attemptedInsertPayload,
      employmentRecordStatusAttempted: attemptedInsertPayload.verification_status ?? null,
    }
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
        details: resolvedIds?.resolutionError || "No se ha podido resolver un employment_record válido para esta experiencia.",
        resolution_step: resolvedIds?.resolutionStep || "employment_record_resolution",
        employment_record_insert_payload: resolvedIds?.employmentRecordInsertPayload || null,
        employment_record_status_attempted: resolvedIds?.employmentRecordStatusAttempted ?? null,
      })
    }

    let existingRequest: any = null

    const activeLookup = await admin
      .from("verification_requests")
      .select("id,status,resolved_at,external_resolved,external_token,external_token_expires_at")
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

    const candidateProfileLookup = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", normalizedRequestedBy)
      .maybeSingle()
    const candidateName = String(candidateProfileLookup.data?.full_name || "").trim() || "Candidato"

    const dispatchVerificationEmail = async (verificationRequest: any) => {
      const tokenResult = await ensureVerificationRequestExternalToken({
        admin,
        verificationRequestId: String(verificationRequest?.id || ""),
        existingToken: verificationRequest?.external_token || null,
        existingExpiresAt: verificationRequest?.external_token_expires_at || null,
      })

      if (!tokenResult.ok || !tokenResult.token) {
        return {
          email_dispatch_attempted: false,
          email_dispatch_provider: "resend",
          email_dispatch_result: "token_generation_failed",
          email_dispatch_error: tokenResult.error?.message || "external_token_update_failed",
          verification_link: null,
        }
      }

      const verificationLink = `${getAppUrl()}/verify-experience/${tokenResult.token}`
      const tpl = buildExternalExperienceVerificationEmail({
        candidateName,
        companyName: normalizedCompanyName,
        roleTitle: normalizedRoleTitle,
        verificationLink,
      })
      const sent = await sendTransactionalEmail({
        to: normalizedEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      })

      return {
        email_dispatch_attempted: true,
        email_dispatch_provider: sent.provider,
        email_dispatch_result: sent.ok ? "sent" : sent.skipped ? "skipped" : "failed",
        email_dispatch_error: sent.error || null,
        verification_link: verificationLink,
      }
    }

    if (existingRequest?.id) {
      if (profileExperienceIdForUpdate) {
        await admin
          .from("profile_experiences")
          .update({ matched_verification_id: existingRequest.id })
          .eq("id", profileExperienceIdForUpdate)
          .eq("user_id", normalizedRequestedBy)
      }

      const emailDispatch = await dispatchVerificationEmail(existingRequest)

      return res.status(200).json({
        ok: true,
        id: existingRequest.id,
        already_exists: true,
        ...emailDispatch,
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

    const employmentUpdate = await markEmploymentRecordVerificationRequested({
      admin,
      employmentRecordId: normalizedEmploymentRecordId,
      candidateId: normalizedRequestedBy,
      verificationRequestId: data.id,
      nowIso: new Date().toISOString(),
    })

    if (profileExperienceIdForUpdate) {
      await admin
        .from("profile_experiences")
        .update({ matched_verification_id: data.id })
        .eq("id", profileExperienceIdForUpdate)
        .eq("user_id", normalizedRequestedBy)
    }

    const emailDispatch = await dispatchVerificationEmail(data)

    return res.status(200).json({
      ok: true,
      id: data.id,
      employment_record_insert_payload: null,
      employment_record_update_payload: employmentUpdate.patchApplied,
      employment_record_status_applied: employmentUpdate.statusApplied,
      employment_record_status_warning: employmentUpdate.ok
        ? null
        : employmentUpdate.error?.message || "employment_record_status_update_failed",
      ...emailDispatch,
    })
  } catch (e: any) {
    return res.status(500).json({
      error: "internal_error",
      details: e.message,
    })
  }
}
