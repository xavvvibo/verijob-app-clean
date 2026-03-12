import { NextResponse } from "next/server";
import { requireOwner } from "@/app/api/internal/owner/_lib";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTION_CHANGE_PLAN = "change_plan";
const ACTION_EXTEND_TRIAL = "extend_trial";
const ACTION_ADD_NOTE = "add_internal_note";
const ACTION_MARK_EXPERIENCE = "mark_experience_manual_review";
const ACTION_MARK_EVIDENCE = "mark_evidence_manual_review";

const ALLOWED_ACTIONS = new Set([
  ACTION_CHANGE_PLAN,
  ACTION_EXTEND_TRIAL,
  ACTION_ADD_NOTE,
  ACTION_MARK_EXPERIENCE,
  ACTION_MARK_EVIDENCE,
]);

const ALLOWED_PLAN_KEYS = new Set([
  "free",
  "candidate_starter_monthly",
  "candidate_pro_monthly",
  "candidate_proplus_monthly",
  "candidate_proplus_yearly",
  "company_access_monthly",
  "company_hiring_monthly",
  "company_team_monthly",
]);

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function asObject(v: unknown): Record<string, any> {
  return v && typeof v === "object" ? (v as Record<string, any>) : {};
}

function toIsoDate(v: unknown) {
  const raw = String(v || "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function getTableColumns(admin: any, tableName: string) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);
  if (error || !Array.isArray(data)) return new Set<string>();
  return new Set(data.map((r: any) => String(r.column_name || "")));
}

async function logOwnerAction(owner: { ownerId: string; admin: any }, targetUserId: string, actionType: string, reason: string, payload: Record<string, any>) {
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
    return { ok: false as const, error };
  }
  return { ok: true as const, action: data };
}

export async function POST(req: Request, ctx: any) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const params = await ctx?.params;
  const targetUserId = String(params?.id || "").trim();
  if (!isUuid(targetUserId)) return json(400, { error: "invalid_target_user_id" });

  const body = await req.json().catch(() => ({}));
  const actionType = String(body?.action_type || "").trim();
  const reason = String(body?.reason || "").trim().slice(0, 500);
  const payload = asObject(body?.payload);

  if (!ALLOWED_ACTIONS.has(actionType)) {
    return json(400, { error: "invalid_action_type" });
  }

  if (!reason) {
    return json(400, { error: "reason_required" });
  }

  const { data: targetAuthUser, error: targetAuthUserErr } = await owner.admin.auth.admin.getUserById(targetUserId);
  if (targetAuthUserErr || !targetAuthUser?.user) {
    return json(404, { error: "target_user_not_found" });
  }

  const { data: targetProfile } = await owner.admin
    .from("profiles")
    .select("id,role")
    .eq("id", targetUserId)
    .maybeSingle();

  const role = String(targetProfile?.role || "").toLowerCase();

  if (actionType === ACTION_CHANGE_PLAN) {
    const targetPlan = String(payload?.target_plan || "").trim().toLowerCase();
    if (!ALLOWED_PLAN_KEYS.has(targetPlan)) {
      return json(400, { error: "invalid_target_plan" });
    }

    const { data: latestSub } = await owner.admin
      .from("subscriptions")
      .select("id,plan,status,current_period_end,metadata")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const columns = await getTableColumns(owner.admin, "subscriptions");
    const metadata = {
      ...(asObject((latestSub as any)?.metadata)),
      owner_override: {
        type: "manual_plan_change",
        owner_user_id: owner.ownerId,
        reason,
        at: new Date().toISOString(),
        target_plan: targetPlan,
      },
    };

    const nextStatus = targetPlan === "free" ? "canceled" : "active";
    const updatePayload: Record<string, any> = {
      plan: targetPlan,
      status: nextStatus,
      metadata,
    };
    if (columns.has("current_period_end")) {
      updatePayload.current_period_end = targetPlan === "free" ? new Date().toISOString() : (latestSub as any)?.current_period_end || null;
    }

    let resultRow: any = null;
    if ((latestSub as any)?.id) {
      const { data: updated, error: updateErr } = await owner.admin
        .from("subscriptions")
        .update(updatePayload)
        .eq("id", (latestSub as any).id)
        .select("id,plan,status,current_period_end,metadata")
        .single();
      if (updateErr) return json(400, { error: "plan_change_failed", details: updateErr.message });
      resultRow = updated;
    } else {
      const insertPayload: Record<string, any> = {
        user_id: targetUserId,
        plan: targetPlan,
        status: nextStatus,
        metadata,
      };
      if (columns.has("current_period_end")) insertPayload.current_period_end = targetPlan === "free" ? new Date().toISOString() : null;
      if (columns.has("amount")) insertPayload.amount = 0;
      if (columns.has("currency")) insertPayload.currency = "eur";

      const { data: inserted, error: insertErr } = await owner.admin
        .from("subscriptions")
        .insert(insertPayload)
        .select("id,plan,status,current_period_end,metadata")
        .single();
      if (insertErr) return json(400, { error: "plan_change_failed", details: insertErr.message });
      resultRow = inserted;
    }

    const logged = await logOwnerAction(owner, targetUserId, ACTION_CHANGE_PLAN, reason, {
      before: latestSub || null,
      after: resultRow || null,
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    return json(200, {
      ok: true,
      executed: true,
      message: "Cambio de plan aplicado correctamente.",
      action: logged.action,
      result: resultRow,
    });
  }

  if (actionType === ACTION_EXTEND_TRIAL) {
    const mode = String(payload?.mode || "days");
    const daysRaw = Number(payload?.days || 0);
    const untilIso = toIsoDate(payload?.until);
    const columns = await getTableColumns(owner.admin, "subscriptions");

    if (mode !== "days" && mode !== "date") return json(400, { error: "invalid_trial_mode" });
    if (mode === "days" && (!Number.isFinite(daysRaw) || daysRaw <= 0 || daysRaw > 365)) {
      return json(400, { error: "invalid_trial_days" });
    }
    if (mode === "date" && !untilIso) return json(400, { error: "invalid_trial_date" });

    const { data: latestSub } = await owner.admin
      .from("subscriptions")
      .select("id,plan,status,current_period_end,metadata")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseTs = (() => {
      const current = Date.parse(String((latestSub as any)?.current_period_end || ""));
      return Number.isFinite(current) && current > Date.now() ? current : Date.now();
    })();
    const nextPeriodEnd = mode === "date"
      ? untilIso!
      : new Date(baseTs + daysRaw * 24 * 60 * 60 * 1000).toISOString();

    const metadata = {
      ...(asObject((latestSub as any)?.metadata)),
      owner_override: {
        type: "trial_extension",
        owner_user_id: owner.ownerId,
        reason,
        at: new Date().toISOString(),
        mode,
        days: mode === "days" ? daysRaw : null,
        until: nextPeriodEnd,
      },
    };

    let resultRow: any = null;
    if ((latestSub as any)?.id) {
      const updatePayload: Record<string, any> = { status: "trialing", metadata };
      if (columns.has("current_period_end")) updatePayload.current_period_end = nextPeriodEnd;
      const { data: updated, error: updateErr } = await owner.admin
        .from("subscriptions")
        .update(updatePayload)
        .eq("id", (latestSub as any).id)
        .select("id,plan,status,current_period_end,metadata")
        .single();
      if (updateErr) return json(400, { error: "extend_trial_failed", details: updateErr.message });
      resultRow = updated;
    } else {
      const rolePlanDefault = role === "company" ? "company_access_monthly" : "candidate_starter_monthly";
      const insertPayload: Record<string, any> = {
        user_id: targetUserId,
        plan: rolePlanDefault,
        status: "trialing",
        metadata,
      };
      if (columns.has("current_period_end")) insertPayload.current_period_end = nextPeriodEnd;
      if (columns.has("amount")) insertPayload.amount = 0;
      if (columns.has("currency")) insertPayload.currency = "eur";
      const { data: inserted, error: insertErr } = await owner.admin
        .from("subscriptions")
        .insert(insertPayload)
        .select("id,plan,status,current_period_end,metadata")
        .single();
      if (insertErr) return json(400, { error: "extend_trial_failed", details: insertErr.message });
      resultRow = inserted;
    }

    const logged = await logOwnerAction(owner, targetUserId, ACTION_EXTEND_TRIAL, reason, {
      before: latestSub || null,
      after: resultRow || null,
      mode,
      days: mode === "days" ? daysRaw : null,
      until: nextPeriodEnd,
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    return json(200, {
      ok: true,
      executed: true,
      message: "Extensión de trial aplicada correctamente.",
      action: logged.action,
      result: resultRow,
    });
  }

  if (actionType === ACTION_ADD_NOTE) {
    const note = String(payload?.note || "").trim().slice(0, 4000);
    if (!note) return json(400, { error: "note_required" });
    const logged = await logOwnerAction(owner, targetUserId, ACTION_ADD_NOTE, reason, { note });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });
    return json(200, {
      ok: true,
      executed: true,
      message: "Nota interna guardada.",
      action: logged.action,
    });
  }

  if (actionType === ACTION_MARK_EXPERIENCE) {
    const experienceId = String(payload?.experience_id || "").trim();
    if (!isUuid(experienceId)) return json(400, { error: "invalid_experience_id" });

    const { data: experienceRow, error: expErr } = await owner.admin
      .from("employment_records")
      .select("id,candidate_id,verification_status")
      .eq("id", experienceId)
      .eq("candidate_id", targetUserId)
      .maybeSingle();
    if (expErr || !experienceRow) return json(404, { error: "experience_not_found" });

    const { data: updated, error: updateErr } = await owner.admin
      .from("employment_records")
      .update({ verification_status: "reviewing" })
      .eq("id", experienceId)
      .select("id,candidate_id,verification_status")
      .single();
    if (updateErr) return json(400, { error: "experience_review_update_failed", details: updateErr.message });

    const logged = await logOwnerAction(owner, targetUserId, ACTION_MARK_EXPERIENCE, reason, {
      experience_id: experienceId,
      before_status: (experienceRow as any)?.verification_status || null,
      after_status: (updated as any)?.verification_status || "reviewing",
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    return json(200, {
      ok: true,
      executed: true,
      message: "Experiencia marcada para revisión manual.",
      action: logged.action,
      result: updated,
    });
  }

  if (actionType === ACTION_MARK_EVIDENCE) {
    const evidenceId = String(payload?.evidence_id || "").trim();
    if (!isUuid(evidenceId)) return json(400, { error: "invalid_evidence_id" });

    const { data: evidenceRow, error: evErr } = await owner.admin
      .from("evidences")
      .select("id,uploaded_by,validation_status,inconsistency_reason")
      .eq("id", evidenceId)
      .eq("uploaded_by", targetUserId)
      .maybeSingle();
    if (evErr || !evidenceRow) return json(404, { error: "evidence_not_found" });

    const updatePayload = {
      validation_status: "needs_review",
      inconsistency_reason: reason,
    };

    const { data: updated, error: updateErr } = await owner.admin
      .from("evidences")
      .update(updatePayload)
      .eq("id", evidenceId)
      .select("id,uploaded_by,validation_status,inconsistency_reason")
      .single();
    if (updateErr) return json(400, { error: "evidence_review_update_failed", details: updateErr.message });

    const logged = await logOwnerAction(owner, targetUserId, ACTION_MARK_EVIDENCE, reason, {
      evidence_id: evidenceId,
      before_status: (evidenceRow as any)?.validation_status || null,
      after_status: (updated as any)?.validation_status || "needs_review",
      before_reason: (evidenceRow as any)?.inconsistency_reason || null,
      after_reason: (updated as any)?.inconsistency_reason || reason,
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    return json(200, {
      ok: true,
      executed: true,
      message: "Evidencia marcada para revisión manual.",
      action: logged.action,
      result: updated,
    });
  }

  return json(400, { error: "unsupported_action" });
}
