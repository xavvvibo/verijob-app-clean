async function updateEmploymentRecordWithFallbacks(args: {
  admin: any
  employmentRecordId: string
  candidateId?: string | null
  patches: Array<Record<string, any>>
}) {
  let lastError: any = null

  for (const patch of args.patches) {
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
        patchApplied: patch,
      }
    }
    lastError = error
  }

  return {
    ok: false as const,
    statusApplied: null,
    patchApplied: null,
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
  return updateEmploymentRecordWithFallbacks({
    admin: args.admin,
    employmentRecordId: args.employmentRecordId,
    candidateId: args.candidateId,
    patches: [
      {
        verification_status: "pending_company",
        last_verification_request_id: args.verificationRequestId,
        last_verification_requested_at: args.nowIso,
        verification_result: null,
        verification_resolved_at: null,
      },
      {
        verification_status: "pending_company",
        last_verification_request_id: args.verificationRequestId,
        last_verification_requested_at: args.nowIso,
      },
      {
        verification_status: "pending_company",
      },
    ],
  })
}

export async function markEmploymentRecordVerificationDecision(args: {
  admin: any
  employmentRecordId: string
  verificationRequestId: string
  nowIso: string
  decision: "approve" | "reject" | "review"
}) {
  const verificationStatus =
    args.decision === "approve" ? "verified" : args.decision === "reject" ? "rejected" : "reviewing"

  const patches =
    args.decision === "review"
      ? [
          {
            verification_status: verificationStatus,
            last_verification_request_id: args.verificationRequestId,
            last_verification_requested_at: args.nowIso,
            verification_result: null,
            verification_resolved_at: null,
          },
          {
            verification_status: verificationStatus,
            last_verification_request_id: args.verificationRequestId,
            last_verification_requested_at: args.nowIso,
          },
          {
            verification_status: verificationStatus,
          },
        ]
      : [
          {
            verification_status: verificationStatus,
            last_verification_request_id: args.verificationRequestId,
            verification_result: args.decision === "approve" ? "approved" : "rejected",
            verification_resolved_at: args.nowIso,
          },
          {
            verification_status: verificationStatus,
            last_verification_request_id: args.verificationRequestId,
          },
          {
            verification_status: verificationStatus,
          },
        ]

  return updateEmploymentRecordWithFallbacks({
    admin: args.admin,
    employmentRecordId: args.employmentRecordId,
    patches,
  })
}
