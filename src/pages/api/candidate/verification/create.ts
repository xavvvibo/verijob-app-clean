import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"
import { createPagesRouteClient } from "@/utils/supabase/pages"
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution"

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
      email,
      requested_by,
      company_name,
      role_title,
    } = req.body ?? {}

    const normalizedEmploymentRecordId = String(employment_record_id ?? "").trim()
    const normalizedEmail = String(email ?? "").trim().toLowerCase()
    const normalizedRequestedBy = String(requested_by ?? user.id ?? "").trim()
    const normalizedCompanyName = String(company_name ?? "").trim() || null
    const normalizedRoleTitle = String(role_title ?? "").trim() || null

    if (!normalizedEmploymentRecordId) {
      return res.status(400).json({ error: "missing_employment_record_id" })
    }

    if (!normalizedEmail) {
      return res.status(400).json({ error: "missing_email" })
    }

    if (normalizedRequestedBy !== user.id) {
      return res.status(403).json({ error: "requested_by_mismatch" })
    }

    const admin = createAdminClient()
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
      await admin
        .from("profile_experiences")
        .update({ matched_verification_id: existingRequest.id })
        .eq("id", normalizedEmploymentRecordId)
        .eq("user_id", normalizedRequestedBy)

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
      .from("profile_experiences")
      .update({ matched_verification_id: data.id })
      .eq("id", normalizedEmploymentRecordId)
      .eq("user_id", normalizedRequestedBy)

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
