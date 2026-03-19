import { NextResponse } from "next/server";
import { requireOwner } from "@/app/api/internal/owner/_lib";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";
import { markEmploymentRecordVerificationDecision } from "@/lib/verification/employment-record-status";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function logOwnerAction(owner: { ownerId: string; admin: any }, targetUserId: string, reason: string, payload: Record<string, any>) {
  const { error } = await owner.admin.from("owner_actions").insert({
    target_user_id: targetUserId,
    owner_user_id: owner.ownerId,
    action_type: "verification_request_review",
    reason,
    payload,
  });
  return { ok: !error, error };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const params = await ctx.params;
  const verificationId = String(params?.id || "").trim();
  if (!isUuid(verificationId)) return json(400, { error: "invalid_verification_id" });

  const body = await req.json().catch(() => ({}));
  const decision = String(body?.decision || "").trim().toLowerCase();
  const reviewNotes = String(body?.review_notes || "").trim().slice(0, 1500);
  const rejectionReason = String(body?.rejected_reason || "").trim().slice(0, 500);

  if (!["approve", "reject", "review"].includes(decision)) {
    return json(400, { error: "invalid_decision" });
  }
  if (decision === "reject" && !rejectionReason) {
    return json(400, { error: "rejected_reason_required" });
  }
  const typedDecision = decision as "approve" | "reject" | "review";

  const { data: current, error: currentErr } = await owner.admin
    .from("verification_requests")
    .select("id,requested_by,employment_record_id,status,revoked_at,resolved_at,resolution_notes")
    .eq("id", verificationId)
    .maybeSingle();

  if (currentErr) return json(400, { error: "verification_read_failed", details: currentErr.message });
  if (!current) return json(404, { error: "verification_not_found" });
  if (current.revoked_at) return json(409, { error: "verification_revoked" });

  const now = new Date().toISOString();
  const nextStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "reviewing";
  const resolutionParts = [
    reviewNotes || null,
    decision === "reject" ? `Motivo rechazo: ${rejectionReason}` : null,
    `Revisión owner: ${decision}`,
  ].filter(Boolean);

  const patch: Record<string, any> = {
    status: nextStatus,
    updated_at: now,
    resolution_notes: resolutionParts.join(" | ") || null,
  };

  if (decision === "review") {
    patch.resolved_at = null;
    patch.resolved_by = null;
  } else {
    patch.resolved_at = now;
    patch.resolved_by = owner.ownerId;
  }

  const { data: updated, error: updateErr } = await owner.admin
    .from("verification_requests")
    .update(patch)
    .eq("id", verificationId)
    .select("id,requested_by,employment_record_id,status,resolved_at,resolution_notes,updated_at")
    .maybeSingle();

  if (updateErr) return json(400, { error: "verification_update_failed", details: updateErr.message });
  if (!updated) return json(409, { error: "verification_update_no_rows" });

  if (updated.employment_record_id) {
    const employmentUpdate = await markEmploymentRecordVerificationDecision({
      admin: owner.admin,
      employmentRecordId: String(updated.employment_record_id),
      verificationRequestId: verificationId,
      nowIso: now,
      decision: typedDecision,
    });
    if (!employmentUpdate.ok) {
      return json(400, { error: "employment_update_failed", details: employmentUpdate.error?.message || "employment_status_update_failed" });
    }
  }

  const targetUserId = String(updated.requested_by || owner.ownerId);
  const reason =
    decision === "approve"
      ? "Owner aprobó manualmente una verificación pendiente"
      : decision === "reject"
        ? "Owner rechazó manualmente una verificación pendiente"
        : "Owner marcó una verificación para revisión manual";

  const logged = await logOwnerAction(owner, targetUserId, reason, {
    verification_request_id: verificationId,
    previous_status: current.status || null,
    next_status: nextStatus,
    reviewed_by: owner.ownerId,
    reviewed_at: now,
    review_notes: reviewNotes || null,
    rejected_reason: decision === "reject" ? rejectionReason : null,
    source: "owner_manual",
  });

  if (!logged.ok) {
    return json(500, { error: "owner_action_log_failed", details: logged.error?.message || "owner_actions_insert_failed" });
  }

  if (updated.requested_by) {
    await recalculateAndPersistCandidateTrustScore(String(updated.requested_by)).catch(() => {});
  }

  return json(200, {
    ok: true,
    verification: updated,
    decision,
    next_status: nextStatus,
  });
}
