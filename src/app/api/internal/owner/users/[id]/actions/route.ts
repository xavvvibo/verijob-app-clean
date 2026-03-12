import { NextResponse } from "next/server";
import { requireOwner } from "@/app/api/internal/owner/_lib";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ACTIONS = new Set([
  "force_plan_change",
  "extend_trial",
  "resend_magic_link",
  "flag_experience_manual_review",
  "flag_evidence_manual_review",
  "add_internal_note",
]);

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request, ctx: any) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const targetUserId = String(ctx?.params?.id || "").trim();
  if (!isUuid(targetUserId)) return json(400, { error: "invalid_target_user_id" });

  const body = await req.json().catch(() => ({}));
  const actionType = String(body?.action_type || "").trim();
  const reason = body?.reason == null ? null : String(body.reason).trim().slice(0, 500);
  const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};

  if (!ALLOWED_ACTIONS.has(actionType)) {
    return json(400, { error: "invalid_action_type" });
  }

  const actionRow = {
    target_user_id: targetUserId,
    owner_user_id: owner.ownerId,
    action_type: actionType,
    reason,
    payload,
  };

  const { data, error } = await owner.admin
    .from("owner_actions")
    .insert(actionRow)
    .select("id,target_user_id,owner_user_id,action_type,reason,payload,created_at")
    .single();

  if (error) {
    return json(500, {
      error: "owner_action_log_failed",
      details: error.message,
    });
  }

  return json(200, {
    ok: true,
    queued: true,
    executed: false,
    message: "Acción registrada para trazabilidad owner.",
    action: data,
  });
}
