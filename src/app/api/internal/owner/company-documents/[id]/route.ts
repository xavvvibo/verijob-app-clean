import { NextResponse } from "next/server";
import { requireOwner } from "@/app/api/internal/owner/_lib";

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
    action_type: "company_document_review",
    reason,
    payload,
  });
  return { ok: !error, error };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const params = await ctx.params;
  const documentId = String(params?.id || "").trim();
  if (!isUuid(documentId)) return json(400, { error: "invalid_document_id" });

  const body = await req.json().catch(() => ({}));
  const decision = String(body?.decision || "").trim().toLowerCase();
  const reviewNotes = String(body?.review_notes || "").trim().slice(0, 1500);
  const rejectionReason = String(body?.rejected_reason || "").trim().slice(0, 500);

  if (decision !== "approve" && decision !== "reject") {
    return json(400, { error: "invalid_decision" });
  }
  if (decision === "reject" && !rejectionReason) {
    return json(400, { error: "rejected_reason_required" });
  }

  const { data: current, error: currentErr } = await owner.admin
    .from("company_verification_documents")
    .select("id,company_id,uploaded_by,document_type,review_status,lifecycle_status,review_notes,rejected_reason")
    .eq("id", documentId)
    .maybeSingle();

  if (currentErr) return json(400, { error: "document_read_failed", details: currentErr.message });
  if (!current) return json(404, { error: "document_not_found" });
  if (String(current.lifecycle_status || "active").toLowerCase() === "deleted") {
    return json(409, { error: "document_deleted" });
  }

  const currentStatus = String(current.review_status || "").toLowerCase();
  const isOverride = currentStatus === "approved" || currentStatus === "rejected";
  if (isOverride && !reviewNotes) {
    return json(400, { error: "review_notes_required_for_override" });
  }

  const reviewedAt = new Date().toISOString();
  const patch = {
    review_status: decision === "approve" ? "approved" : "rejected",
    status: decision === "approve" ? "approved" : "rejected",
    reviewed_by: owner.ownerId,
    reviewed_at: reviewedAt,
    review_notes: reviewNotes || null,
    rejected_reason: decision === "reject" ? rejectionReason : null,
    updated_at: reviewedAt,
  };

  const { data: updated, error: updateErr } = await owner.admin
    .from("company_verification_documents")
    .update(patch)
    .eq("id", documentId)
    .select("id,company_id,uploaded_by,document_type,review_status,rejected_reason,review_notes,reviewed_by,reviewed_at,lifecycle_status,created_at,updated_at")
    .maybeSingle();

  if (updateErr) return json(400, { error: "document_update_failed", details: updateErr.message });
  if (!updated) return json(409, { error: "document_update_no_rows" });

  const reason = decision === "approve"
    ? `Owner aprobó manualmente documento ${String(updated.document_type || "empresa")}`
    : `Owner rechazó manualmente documento ${String(updated.document_type || "empresa")}`;
  const logged = await logOwnerAction(owner, String(updated.uploaded_by || owner.ownerId), reason, {
    document_id: updated.id,
    company_id: updated.company_id,
    decision,
    reviewed_by: owner.ownerId,
    reviewed_at: reviewedAt,
    review_notes: patch.review_notes,
    rejected_reason: patch.rejected_reason,
    previous_review_status: current.review_status || null,
    source: "owner_manual",
  });

  if (!logged.ok) {
    return json(500, { error: "owner_action_log_failed", details: logged.error?.message || "owner_actions_insert_failed" });
  }

  return json(200, {
    ok: true,
    decision_source: "owner_manual",
    document: updated,
  });
}
