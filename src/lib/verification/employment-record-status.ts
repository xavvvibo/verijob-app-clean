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

async function applyEmploymentPatchVariants(args: {
  admin: any
  employmentRecordId: string
  candidateId?: string | null
  basePatch: Record<string, any>
  statusVariants: string[]
}) {
  const columns = await getTableColumns(args.admin, "employment_records")
  const canWriteStatus = columns.has("verification_status")
  const variants = canWriteStatus
    ? [...args.statusVariants.map((status) => ({ ...args.basePatch, verification_status: status })), args.basePatch]
    : [args.basePatch]

  let lastError: any = null

  for (const patch of variants) {
    let query = args.admin.from("employment_records").update(patch).eq("id", args.employmentRecordId)
    if (args.candidateId) {
      query = query.eq("candidate_id", args.candidateId)
    }

    const { error } = await query
    if (!error) {
      return {
        ok: true as const,
        statusApplied: Object.prototype.hasOwnProperty.call(patch, "verification_status")
          ? patch.verification_status
          : null,
      }
    }
    lastError = error
  }

  return {
    ok: false as const,
    statusApplied: null,
    error: lastError,
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

  return applyEmploymentPatchVariants({
    admin: args.admin,
    employmentRecordId: args.employmentRecordId,
    candidateId: args.candidateId,
    basePatch,
    statusVariants: ["pending_company", "company_registered_pending"],
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

  const statusVariants =
    args.decision === "approve"
      ? ["verified"]
      : args.decision === "reject"
        ? ["rejected"]
        : ["reviewing", "pending_company", "company_registered_pending"]

  return applyEmploymentPatchVariants({
    admin: args.admin,
    employmentRecordId: args.employmentRecordId,
    basePatch,
    statusVariants,
  })
}
