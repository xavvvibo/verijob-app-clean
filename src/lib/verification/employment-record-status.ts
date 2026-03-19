async function getTableColumns(admin: any, tableName: string) {
  try {
    const { data, error } = await admin
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

function buildBaseEmploymentPatch(columns: Set<string>, args: {
  verificationRequestId: string
  nowIso: string
  clearResolution?: boolean
  verificationResult?: string | null
}) {
  const patch: Record<string, any> = {}

  if (columns.has("last_verification_request_id")) {
    patch.last_verification_request_id = args.verificationRequestId
  }
  if (columns.has("last_verification_requested_at")) {
    patch.last_verification_requested_at = args.nowIso
  }
  if (columns.has("verification_result")) {
    patch.verification_result = args.verificationResult ?? null
  }
  if (columns.has("verification_resolved_at") && args.clearResolution) {
    patch.verification_resolved_at = null
  }

  return patch
}

async function applyEmploymentPatch(args: {
  admin: any
  employmentRecordId: string
  candidateId?: string | null
  patch: Record<string, any>
}) {
  let query = args.admin.from("employment_records").update(args.patch).eq("id", args.employmentRecordId)
  if (args.candidateId) {
    query = query.eq("candidate_id", args.candidateId)
  }
  const { error } = await query

  if (error) {
    return {
      ok: false as const,
      statusApplied: null,
      error,
    }
  }

  return {
    ok: true as const,
    statusApplied: Object.prototype.hasOwnProperty.call(args.patch, "verification_status")
      ? args.patch.verification_status
      : null,
  }
}

export async function markEmploymentRecordVerificationRequested(args: {
  admin: any
  employmentRecordId: string
  candidateId?: string | null
  verificationRequestId: string
  nowIso: string
}) {
  const columns = await getTableColumns(args.admin, "employment_records")
  const basePatch = buildBaseEmploymentPatch(columns, {
    verificationRequestId: args.verificationRequestId,
    nowIso: args.nowIso,
    clearResolution: true,
    verificationResult: null,
  })
  if (columns.has("verification_status")) {
    basePatch.verification_status = "pending_company"
  }

  return applyEmploymentPatch({
    admin: args.admin,
    employmentRecordId: args.employmentRecordId,
    candidateId: args.candidateId,
    patch: basePatch,
  })
}

export async function markEmploymentRecordVerificationDecision(args: {
  admin: any
  employmentRecordId: string
  verificationRequestId: string
  nowIso: string
  decision: "approve" | "reject" | "review"
}) {
  const columns = await getTableColumns(args.admin, "employment_records")
  const basePatch = buildBaseEmploymentPatch(columns, {
    verificationRequestId: args.verificationRequestId,
    nowIso: args.nowIso,
    clearResolution: args.decision === "review",
    verificationResult:
      args.decision === "approve" ? "approved" : args.decision === "reject" ? "rejected" : null,
  })

  if (columns.has("verification_resolved_at") && args.decision !== "review") {
    basePatch.verification_resolved_at = args.nowIso
  }
  if (columns.has("verification_status")) {
    basePatch.verification_status =
      args.decision === "approve" ? "verified" : args.decision === "reject" ? "rejected" : "reviewing"
  }

  return applyEmploymentPatch({
    admin: args.admin,
    employmentRecordId: args.employmentRecordId,
    patch: basePatch,
  })
}
