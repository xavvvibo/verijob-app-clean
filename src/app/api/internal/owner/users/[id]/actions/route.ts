import { NextResponse } from "next/server";
import { requireOwner } from "@/app/api/internal/owner/_lib";
import {
  getManagedSubscriptionPlansForRole,
  managedPlanLabel,
  normalizeManagedSubscriptionPlanKey,
} from "@/lib/billing/managedPlans";
import {
  readEffectiveCompanySubscriptionState,
  readEffectiveSubscriptionState,
} from "@/lib/billing/effectiveSubscription";
import { buildSubscriptionLifecycleEmail } from "@/lib/email/templates/subscriptionLifecycle";
import { resetCandidateAccountForQa } from "@/lib/account/qa-reset";
import { clearCandidateProfileCollections } from "@/lib/candidate/profile-collections";
import { sendTransactionalEmail } from "@/server/email/sendTransactionalEmail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTION_CHANGE_PLAN = "change_plan";
const ACTION_CANCEL_SUBSCRIPTION = "cancel_subscription";
const ACTION_EXTEND_TRIAL = "extend_trial";
const ACTION_ADD_NOTE = "add_internal_note";
const ACTION_MARK_EXPERIENCE = "mark_experience_manual_review";
const ACTION_MARK_EVIDENCE = "mark_evidence_manual_review";
const ACTION_REPAIR_COMPANY_CONTEXT = "repair_company_context";
const ACTION_ARCHIVE_USER = "archive_user";
const ACTION_DISABLE_USER = "disable_user";
const ACTION_REACTIVATE_USER = "reactivate_user";
const ACTION_RESET_CANDIDATE = "reset_candidate";
const ACTION_HARD_DELETE_USER = "hard_delete_user";
const ACTION_DELETE_USER = "delete_user";

const ALLOWED_ACTIONS = new Set([
  ACTION_CHANGE_PLAN,
  ACTION_CANCEL_SUBSCRIPTION,
  ACTION_EXTEND_TRIAL,
  ACTION_ADD_NOTE,
  ACTION_MARK_EXPERIENCE,
  ACTION_MARK_EVIDENCE,
  ACTION_REPAIR_COMPANY_CONTEXT,
  ACTION_ARCHIVE_USER,
  ACTION_DELETE_USER,
  ACTION_DISABLE_USER,
  ACTION_REACTIVATE_USER,
  ACTION_RESET_CANDIDATE,
  ACTION_HARD_DELETE_USER,
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

function asText(v: unknown, max = 500) {
  return String(v || "").trim().slice(0, max);
}

async function createOwnerPlanOverride(args: {
  admin: any;
  targetUserId: string;
  targetPlan: string;
  ownerId: string;
  reason: string;
  activeCompanyId?: string | null;
}) {
  const overrideColumns = await getTableColumns(args.admin, "plan_overrides");
  const nowIso = new Date().toISOString();
  const insertPayload: Record<string, any> = {
    user_id: args.targetUserId,
    plan_key: args.targetPlan,
    source_type: "owner_manual_plan_change",
    source_id: null,
    starts_at: nowIso,
    expires_at: null,
    is_active: true,
    metadata: {
      reason: args.reason,
      owner_user_id: args.ownerId,
      target_plan: args.targetPlan,
      company_id: args.activeCompanyId || null,
    },
  };
  if (overrideColumns.has("company_id") && args.activeCompanyId) {
    insertPayload.company_id = args.activeCompanyId;
  }

  const { data, error } = await args.admin
    .from("plan_overrides")
    .insert(insertPayload)
    .select("id,plan_key,source_type,source_id,starts_at,expires_at,is_active,metadata,created_at")
    .single();

  if (error) {
    return { ok: false as const, error };
  }

  return {
    ok: true as const,
    row: {
      id: data.id,
      plan: data.plan_key,
      status: "active",
      current_period_end: data.expires_at,
      metadata: data.metadata,
      source: "override",
    },
  };
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

function makeFallbackCompanyName(emailRaw: unknown) {
  const email = String(emailRaw || "").trim().toLowerCase();
  const local = email.split("@")[0] || "empresa";
  return `Empresa ${local.slice(0, 40)}`;
}

function planLabel(raw: unknown) {
  return managedPlanLabel(raw);
}

function isCompanyPlan(raw: unknown) {
  return String(raw || "").toLowerCase().startsWith("company_");
}

function getAppUrl() {
  return String(process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es").replace(/\/+$/, "");
}

async function readLatestSubscriptionForTarget(args: {
  admin: any;
  targetUserId: string;
  activeCompanyId?: string | null;
  subscriptionsColumns?: Set<string>;
}) {
  const subscriptionsColumns =
    args.subscriptionsColumns || (await getTableColumns(args.admin, "subscriptions"));
  const hasCompanyId = subscriptionsColumns.has("company_id");
  if (hasCompanyId && args.activeCompanyId) {
    const { data } = await args.admin
      .from("subscriptions")
      .select("id,plan,status,current_period_end,metadata,company_id")
      .eq("company_id", args.activeCompanyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  const { data } = await args.admin
    .from("subscriptions")
    .select("id,plan,status,current_period_end,metadata")
    .eq("user_id", args.targetUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function sendOwnerSubscriptionEmail(args: {
  kind: "owner_plan_updated" | "trial_extended";
  toEmail: string | null;
  targetPlan?: string | null;
  previousPlan?: string | null;
  trialEnd?: string | null;
  reason: string;
}) {
  const to = String(args.toEmail || "").trim().toLowerCase();
  if (!to) return { ok: false as const, skipped: true as const, error: "target_email_missing" };
  const appUrl = getAppUrl();
  const company = isCompanyPlan(args.targetPlan) || isCompanyPlan(args.previousPlan);
  const dashboardUrl = company ? `${appUrl}/company/subscription` : `${appUrl}/candidate/subscription`;
  const tpl = buildSubscriptionLifecycleEmail({
    kind: args.kind,
    planName: planLabel(args.targetPlan),
    previousPlanName: args.previousPlan ? planLabel(args.previousPlan) : null,
    periodEnd: args.trialEnd || null,
    immediate: true,
    reason: args.reason,
    dashboardUrl,
    billingUrl: dashboardUrl,
  });
  return sendTransactionalEmail({
    to,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

async function readProfileById(admin: any, userId: string, columns: Set<string>) {
  const selected = [
    "id",
    "email",
    "full_name",
    "role",
    "onboarding_completed",
    "active_company_id",
    columns.has("lifecycle_status") ? "lifecycle_status" : null,
    columns.has("deleted_at") ? "deleted_at" : null,
    columns.has("deleted_by") ? "deleted_by" : null,
    columns.has("deletion_reason") ? "deletion_reason" : null,
  ]
    .filter(Boolean)
    .join(",");

  return admin.from("profiles").select(selected).eq("id", userId).maybeSingle();
}

async function deactivateCandidatePublicLinks(admin: any, userId: string) {
  await admin
    .from("candidate_public_links")
    .update({ is_active: false })
    .eq("candidate_id", userId)
    .eq("is_active", true);
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
    .select("id,role,active_company_id")
    .eq("id", targetUserId)
    .maybeSingle();

  const role = String(targetProfile?.role || "").toLowerCase();
  const activeCompanyId = String(targetProfile?.active_company_id || "").trim() || null;

  if (actionType === ACTION_DISABLE_USER) {
    const profileColumns = await getTableColumns(owner.admin, "profiles");
    const { data: profileBefore, error: profileBeforeErr } = await readProfileById(owner.admin, targetUserId, profileColumns);
    if (profileBeforeErr) return json(400, { error: "profiles_read_failed", details: profileBeforeErr.message });

    const nowIso = new Date().toISOString();
    const patch: Record<string, any> = {};
    if (profileColumns.has("lifecycle_status")) patch.lifecycle_status = "disabled";
    if (profileColumns.has("deletion_reason")) patch.deletion_reason = reason;
    if (profileColumns.has("deleted_at")) patch.deleted_at = null;
    const { data: profileAfter, error: profileErr } = await owner.admin
      .from("profiles")
      .update(patch)
      .eq("id", targetUserId)
      .select("*")
      .single();
    if (profileErr) return json(400, { error: "user_disable_failed", details: profileErr.message });

    let authUpdateError: string | null = null;
    const { error: authErr } = await owner.admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: "876000h",
    });
    if (authErr) authUpdateError = authErr.message;

    if (role === "candidate") {
      await deactivateCandidatePublicLinks(owner.admin, targetUserId);
    }

    const logged = await logOwnerAction(owner, targetUserId, ACTION_DISABLE_USER, reason, {
      before: profileBefore || null,
      after: profileAfter || null,
      disabled_at: nowIso,
      auth_update_error: authUpdateError,
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    return json(200, {
      ok: true,
      executed: true,
      message: authUpdateError
        ? "Usuario desactivado, pero no se pudo bloquear acceso en Auth."
        : "Usuario desactivado correctamente.",
      warning: authUpdateError ? "auth_disable_signin_failed" : null,
      warning_details: authUpdateError,
      action: logged.action,
      result: profileAfter,
    });
  }

  if (actionType === ACTION_REACTIVATE_USER) {
    const profileColumns = await getTableColumns(owner.admin, "profiles");
    const { data: profileBefore, error: profileBeforeErr } = await readProfileById(owner.admin, targetUserId, profileColumns);
    if (profileBeforeErr) return json(400, { error: "profiles_read_failed", details: profileBeforeErr.message });

    const patch: Record<string, any> = {};
    if (profileColumns.has("lifecycle_status")) patch.lifecycle_status = "active";
    if (profileColumns.has("deleted_at")) patch.deleted_at = null;
    if (profileColumns.has("deleted_by")) patch.deleted_by = null;
    if (profileColumns.has("deletion_reason")) patch.deletion_reason = null;
    const { data: profileAfter, error: profileErr } = await owner.admin
      .from("profiles")
      .update(patch)
      .eq("id", targetUserId)
      .select("*")
      .single();
    if (profileErr) return json(400, { error: "user_reactivate_failed", details: profileErr.message });

    let authUpdateError: string | null = null;
    const { error: authErr } = await owner.admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: "none",
    });
    if (authErr) authUpdateError = authErr.message;

    const logged = await logOwnerAction(owner, targetUserId, ACTION_REACTIVATE_USER, reason, {
      before: profileBefore || null,
      after: profileAfter || null,
      auth_update_error: authUpdateError,
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    return json(200, {
      ok: true,
      executed: true,
      message: authUpdateError
        ? "Usuario reactivado, pero no se pudo restaurar el acceso en Auth."
        : "Usuario reactivado correctamente.",
      warning: authUpdateError ? "auth_reactivate_failed" : null,
      warning_details: authUpdateError,
      action: logged.action,
      result: profileAfter,
    });
  }

  if (actionType === ACTION_RESET_CANDIDATE) {
    if (role !== "candidate") {
      return json(400, { error: "candidate_role_required" });
    }

    let result;
    try {
      result = await resetCandidateAccountForQa({
        admin: owner.admin,
        userId: targetUserId,
        userEmail: targetAuthUser.user.email || "",
        bypassEmailCheck: true,
      });
    } catch (error: any) {
      return json(500, {
        error: "candidate_reset_failed",
        details: String(error?.message || error),
      });
    }

    if (!result?.ok) {
      return json(400, {
        error: result?.error || "candidate_reset_failed",
        details: result?.user_message || null,
      });
    }

    const logged = await logOwnerAction(owner, targetUserId, ACTION_RESET_CANDIDATE, reason, {
      cleaned: result.cleaned,
      validation: result.validation,
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    return json(200, {
      ok: true,
      executed: true,
      message: "Candidato reseteado correctamente.",
      action: logged.action,
      result,
    });
  }

  if (actionType === ACTION_HARD_DELETE_USER) {
    if (role !== "candidate") {
      return json(400, { error: "candidate_role_required" });
    }

    const confirmPhrase = asText(payload?.confirm_phrase, 64).toUpperCase();
    if (confirmPhrase !== "DELETE") return json(400, { error: "invalid_confirmation_phrase" });

    const nowIso = new Date().toISOString();
    const profileColumns = await getTableColumns(owner.admin, "profiles");
    const { data: profileBefore, error: profileBeforeErr } = await readProfileById(owner.admin, targetUserId, profileColumns);
    if (profileBeforeErr) return json(400, { error: "profiles_read_failed", details: profileBeforeErr.message });

    let cleanupResult: any = null;
    try {
      cleanupResult = await resetCandidateAccountForQa({
        admin: owner.admin,
        userId: targetUserId,
        userEmail: asText(targetAuthUser.user.email, 320),
        bypassEmailCheck: true,
      });
    } catch (error: any) {
      return json(400, {
        error: "hard_delete_cleanup_failed",
        details: String(error?.message || error || "candidate_cleanup_failed"),
      });
    }

    if (!cleanupResult?.ok) {
      return json(400, {
        error: "hard_delete_cleanup_failed",
        details: String(cleanupResult?.user_message || cleanupResult?.error || "candidate_cleanup_failed"),
      });
    }

    try {
      await clearCandidateProfileCollections(owner.admin, targetUserId);
      await deactivateCandidatePublicLinks(owner.admin, targetUserId);
    } catch (error: any) {
      return json(400, {
        error: "hard_delete_cleanup_failed",
        details: String(error?.message || error || "candidate_cleanup_finalize_failed"),
      });
    }

    const profilePatch: Record<string, any> = {
      onboarding_completed: false,
      active_company_id: null,
    };
    if (profileColumns.has("lifecycle_status")) profilePatch.lifecycle_status = "deleted";
    if (profileColumns.has("deleted_at")) profilePatch.deleted_at = nowIso;
    if (profileColumns.has("deleted_by")) profilePatch.deleted_by = owner.ownerId;
    if (profileColumns.has("deletion_reason")) profilePatch.deletion_reason = reason;
    if (profileColumns.has("full_name")) profilePatch.full_name = "Perfil eliminado";
    if (profileColumns.has("identity_type")) profilePatch.identity_type = null;
    if (profileColumns.has("identity_masked")) profilePatch.identity_masked = null;
    if (profileColumns.has("identity_hash")) profilePatch.identity_hash = null;
    if (profileColumns.has("title")) profilePatch.title = null;
    if (profileColumns.has("location")) profilePatch.location = null;

    const { data: profileAfter, error: profileErr } = await owner.admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", targetUserId)
      .select("*")
      .single();
    if (profileErr) return json(400, { error: "hard_delete_profile_failed", details: profileErr.message });

    const { error: authDisableErr } = await owner.admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: "876000h",
    });
    if (authDisableErr) {
      return json(400, {
        error: "hard_delete_auth_disable_failed",
        details: authDisableErr.message,
      });
    }

    const logged = await logOwnerAction(owner, targetUserId, ACTION_HARD_DELETE_USER, reason, {
      before: profileBefore || null,
      after: profileAfter || null,
      deletion_mode: "hard_delete_equivalent",
      auth_strategy: "auth_user_preserved_but_signin_disabled",
      cleaned: cleanupResult?.cleaned || null,
      validation: cleanupResult?.validation || null,
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    return json(200, {
      ok: true,
      executed: true,
      message: "Candidato eliminado con borrado fuerte equivalente. El acceso queda bloqueado y el perfil sale del sistema operativo.",
      action: logged.action,
      result: {
        profile: profileAfter,
        cleanup: cleanupResult,
        deletion_mode: "hard_delete_equivalent",
      },
    });
  }

  if (actionType === ACTION_CHANGE_PLAN || actionType === ACTION_CANCEL_SUBSCRIPTION) {
    const isCompanyTarget = role === "company" && activeCompanyId;
    const effectiveBefore = isCompanyTarget
      ? await readEffectiveCompanySubscriptionState(owner.admin, {
          userId: targetUserId,
          companyId: activeCompanyId,
        })
      : await readEffectiveSubscriptionState(owner.admin, targetUserId);
    const targetPlan =
      actionType === ACTION_CANCEL_SUBSCRIPTION
        ? "free"
        : normalizeManagedSubscriptionPlanKey(payload?.target_plan);
    if (!targetPlan) {
      return json(400, { error: "invalid_target_plan" });
    }

    const inferredRole =
      role === "company" || targetProfile?.active_company_id
        ? "company"
        : role === "candidate"
          ? "candidate"
          : targetPlan.startsWith("company_")
            ? "company"
            : "candidate";
    const rolePlans = new Set(
      getManagedSubscriptionPlansForRole(inferredRole === "company" ? "company" : "candidate").map((plan) => plan.key)
    );
    if (!rolePlans.has(targetPlan as any)) {
      return json(400, { error: "invalid_target_plan_for_role" });
    }

    await owner.admin
      .from("plan_overrides")
      .update({
        is_active: false,
        metadata: {
          deactivated_by_owner: owner.ownerId,
          deactivated_at: new Date().toISOString(),
          deactivation_reason: reason,
        },
      })
      .eq("user_id", targetUserId)
      .eq("is_active", true);

    let resultRow: any = null;
    if (targetPlan !== "free") {
      const overrideRes = await createOwnerPlanOverride({
        admin: owner.admin,
        targetUserId,
        targetPlan,
        ownerId: owner.ownerId,
        reason,
        activeCompanyId: inferredRole === "company" ? activeCompanyId : null,
      });
      if (!overrideRes.ok) {
        return json(400, { error: "plan_override_create_failed", details: overrideRes.error.message });
      }
      resultRow = overrideRes.row;
    } else {
      resultRow = {
        id: null,
        plan: "free",
        status: "free",
        current_period_end: null,
        metadata: {
          owner_override: {
            type: "manual_plan_change",
            owner_user_id: owner.ownerId,
            reason,
            at: new Date().toISOString(),
            target_plan: "free",
          },
        },
        source: "override",
      };
    }

    const logged = await logOwnerAction(owner, targetUserId, actionType, reason, {
      before: effectiveBefore,
      after: resultRow || null,
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    const targetEmail =
      asText(targetAuthUser.user.email, 320) ||
      asText((payload as any)?.email, 320) ||
      null;
    const emailResult = await sendOwnerSubscriptionEmail({
      kind: "owner_plan_updated",
      toEmail: targetEmail,
      targetPlan,
      previousPlan: effectiveBefore.plan || null,
      reason,
    });

    return json(200, {
      ok: true,
      executed: true,
      message:
        actionType === ACTION_CANCEL_SUBSCRIPTION
          ? "Suscripción cancelada correctamente."
          : "Cambio de plan aplicado correctamente.",
      action: logged.action,
      result: resultRow,
      email_notification: {
        ok: Boolean((emailResult as any)?.ok),
        skipped: Boolean((emailResult as any)?.skipped),
        error: (emailResult as any)?.error || null,
      },
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

    const latestSub = await readLatestSubscriptionForTarget({
      admin: owner.admin,
      targetUserId,
      activeCompanyId,
      subscriptionsColumns: columns,
    });

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
      if (columns.has("company_id") && activeCompanyId && role === "company") {
        insertPayload.company_id = activeCompanyId;
      }
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

    const targetEmail =
      asText(targetAuthUser.user.email, 320) ||
      asText((payload as any)?.email, 320) ||
      null;
    const emailResult = await sendOwnerSubscriptionEmail({
      kind: "trial_extended",
      toEmail: targetEmail,
      targetPlan: (resultRow as any)?.plan || (latestSub as any)?.plan || null,
      previousPlan: (latestSub as any)?.plan || null,
      trialEnd: nextPeriodEnd,
      reason,
    });

    return json(200, {
      ok: true,
      executed: true,
      message: "Extensión de trial aplicada correctamente.",
      action: logged.action,
      result: resultRow,
      email_notification: {
        ok: Boolean((emailResult as any)?.ok),
        skipped: Boolean((emailResult as any)?.skipped),
        error: (emailResult as any)?.error || null,
      },
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
      .update({ verification_status: "verification_requested" })
      .eq("id", experienceId)
      .select("id,candidate_id,verification_status")
      .single();
    if (updateErr) return json(400, { error: "experience_review_update_failed", details: updateErr.message });

    const logged = await logOwnerAction(owner, targetUserId, ACTION_MARK_EXPERIENCE, reason, {
      experience_id: experienceId,
      before_status: (experienceRow as any)?.verification_status || null,
      after_status: (updated as any)?.verification_status || "verification_requested",
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

  if (actionType === ACTION_REPAIR_COMPANY_CONTEXT) {
    const profileColumns = await getTableColumns(owner.admin, "profiles");
    const { data: profileBefore, error: profileBeforeErr } = await readProfileById(owner.admin, targetUserId, profileColumns);
    if (profileBeforeErr) return json(400, { error: "profiles_read_failed", details: profileBeforeErr.message });

    const targetEmail = asText(targetAuthUser.user.email, 320) || asText(profileBefore?.email, 320) || null;
    const requestedCompanyId = asText(payload?.company_id, 120);
    const customCompanyName = asText(payload?.company_name, 180);
    const keepOnboardingCompleted = Boolean(payload?.keep_onboarding_completed);

    let resolvedCompanyId: string | null = null;
    let companyResolution: "requested" | "profile_active_company" | "latest_membership" | "created" = "created";
    let resolvedCompanyName: string | null = null;

    if (requestedCompanyId) {
      if (!isUuid(requestedCompanyId)) return json(400, { error: "invalid_company_id" });
      const { data: requestedCompany, error: requestedCompanyErr } = await owner.admin
        .from("companies")
        .select("id,name")
        .eq("id", requestedCompanyId)
        .maybeSingle();
      if (requestedCompanyErr || !requestedCompany?.id) return json(404, { error: "company_not_found" });
      resolvedCompanyId = String(requestedCompany.id);
      resolvedCompanyName = asText(requestedCompany.name, 180) || null;
      companyResolution = "requested";
    }

    if (!resolvedCompanyId && isUuid(String(profileBefore?.active_company_id || ""))) {
      const activeCompanyId = String(profileBefore?.active_company_id || "");
      const { data: activeCompany } = await owner.admin
        .from("companies")
        .select("id,name")
        .eq("id", activeCompanyId)
        .maybeSingle();
      if (activeCompany?.id) {
        resolvedCompanyId = String(activeCompany.id);
        resolvedCompanyName = asText(activeCompany.name, 180) || null;
        companyResolution = "profile_active_company";
      }
    }

    if (!resolvedCompanyId) {
      const { data: latestMembership } = await owner.admin
        .from("company_members")
        .select("company_id,created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const membershipCompanyId = asText(latestMembership?.company_id, 120);
      if (membershipCompanyId && isUuid(membershipCompanyId)) {
        const { data: membershipCompany } = await owner.admin
          .from("companies")
          .select("id,name")
          .eq("id", membershipCompanyId)
          .maybeSingle();
        if (membershipCompany?.id) {
          resolvedCompanyId = String(membershipCompany.id);
          resolvedCompanyName = asText(membershipCompany.name, 180) || null;
          companyResolution = "latest_membership";
        }
      }
    }

    if (!resolvedCompanyId) {
      const fallbackName = customCompanyName || makeFallbackCompanyName(targetEmail);
      const { data: createdCompany, error: createCompanyErr } = await owner.admin
        .from("companies")
        .insert({
          name: fallbackName,
        })
        .select("id,name")
        .single();
      if (createCompanyErr || !createdCompany?.id) {
        return json(400, { error: "companies_create_failed", details: createCompanyErr?.message || null });
      }
      resolvedCompanyId = String(createdCompany.id);
      resolvedCompanyName = asText(createdCompany.name, 180) || fallbackName;
      companyResolution = "created";
    }

    const { data: existingMembership } = await owner.admin
      .from("company_members")
      .select("company_id,user_id,role")
      .eq("company_id", resolvedCompanyId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!existingMembership) {
      const { error: insertMembershipErr } = await owner.admin.from("company_members").insert({
        company_id: resolvedCompanyId,
        user_id: targetUserId,
        role: "admin",
      });
      if (insertMembershipErr) {
        return json(400, { error: "company_members_insert_failed", details: insertMembershipErr.message });
      }
    } else if (String(existingMembership.role || "").toLowerCase() !== "admin") {
      const { error: updateMembershipErr } = await owner.admin
        .from("company_members")
        .update({ role: "admin" })
        .eq("company_id", resolvedCompanyId)
        .eq("user_id", targetUserId);
      if (updateMembershipErr) {
        return json(400, { error: "company_members_update_failed", details: updateMembershipErr.message });
      }
    }

    await owner.admin
      .from("company_profiles")
      .upsert(
        {
          company_id: resolvedCompanyId,
          contact_email: targetEmail,
        },
        { onConflict: "company_id" }
      );

    const profilePatch: Record<string, any> = {
      id: targetUserId,
      role: "company",
      active_company_id: resolvedCompanyId,
      onboarding_completed: keepOnboardingCompleted ? Boolean(profileBefore?.onboarding_completed) : false,
    };
    if (targetEmail) profilePatch.email = targetEmail;
    if (profileColumns.has("lifecycle_status")) profilePatch.lifecycle_status = "active";
    if (profileColumns.has("deleted_at")) profilePatch.deleted_at = null;
    if (profileColumns.has("deleted_by")) profilePatch.deleted_by = null;
    if (profileColumns.has("deletion_reason")) profilePatch.deletion_reason = null;

    const { data: profileAfter, error: profileUpsertErr } = await owner.admin
      .from("profiles")
      .upsert(profilePatch, { onConflict: "id" })
      .select("*")
      .single();
    if (profileUpsertErr) {
      return json(400, { error: "profiles_upsert_failed", details: profileUpsertErr.message });
    }

    await owner.admin.auth.admin.updateUserById(targetUserId, { ban_duration: "none" });

    const logged = await logOwnerAction(owner, targetUserId, ACTION_REPAIR_COMPANY_CONTEXT, reason, {
      company_resolution: companyResolution,
      company_id: resolvedCompanyId,
      company_name: resolvedCompanyName,
      before: profileBefore || null,
      after: profileAfter || null,
      keep_onboarding_completed: keepOnboardingCompleted,
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    return json(200, {
      ok: true,
      executed: true,
      message: "Cuenta reparada como empresa correctamente.",
      action: logged.action,
      result: {
        profile: profileAfter,
        company_id: resolvedCompanyId,
        company_name: resolvedCompanyName,
        company_resolution: companyResolution,
      },
    });
  }

  if (actionType === ACTION_ARCHIVE_USER || actionType === ACTION_DELETE_USER) {
    const profileColumns = await getTableColumns(owner.admin, "profiles");
    if (!profileColumns.has("lifecycle_status") || !profileColumns.has("deleted_at")) {
      return json(400, {
        error: "user_lifecycle_missing_migration",
        details: "Ejecuta scripts/sql/f33_user_lifecycle_and_legacy_bootstrap.sql",
      });
    }

    const confirmPhrase = asText(payload?.confirm_phrase, 64).toUpperCase();
    if (confirmPhrase !== "ELIMINAR") return json(400, { error: "invalid_confirmation_phrase" });

    const clearFullName = Boolean(payload?.clear_full_name ?? true);
    const keepRole = Boolean(payload?.keep_role ?? true);
    const disableSignIn = Boolean(payload?.disable_signin ?? true);

    const { data: profileBefore, error: profileBeforeErr } = await readProfileById(owner.admin, targetUserId, profileColumns);
    if (profileBeforeErr) return json(400, { error: "profiles_read_failed", details: profileBeforeErr.message });
    if (String(profileBefore?.lifecycle_status || "").toLowerCase() === "deleted") {
      return json(409, { error: "already_archived" });
    }

    const nowIso = new Date().toISOString();
    const profilePatch: Record<string, any> = {
      id: targetUserId,
      lifecycle_status: "deleted",
      deleted_at: nowIso,
      deletion_reason: reason,
      onboarding_completed: false,
      active_company_id: profileBefore?.active_company_id || null,
      role: String(profileBefore?.role || "candidate"),
      email: asText(targetAuthUser.user.email, 320) || asText(profileBefore?.email, 320) || null,
    };
    if (profileColumns.has("deleted_by")) profilePatch.deleted_by = owner.ownerId;
    if (!keepRole) profilePatch.role = "candidate";
    if (clearFullName) profilePatch.full_name = null;

    const { data: profileAfter, error: profileUpdateErr } = await owner.admin
      .from("profiles")
      .upsert(profilePatch, { onConflict: "id" })
      .select("*")
      .single();
    if (profileUpdateErr) return json(400, { error: "profiles_archive_failed", details: profileUpdateErr.message });

    let authUpdateError: string | null = null;
    if (disableSignIn) {
      const { error: authErr } = await owner.admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "876000h",
      });
      if (authErr) authUpdateError = authErr.message;
    }

    const logged = await logOwnerAction(owner, targetUserId, actionType, reason, {
      before: profileBefore || null,
      after: profileAfter || null,
      disable_signin: disableSignIn,
      auth_update_error: authUpdateError,
      data_preservation: {
        verification_requests: "preserved",
        evidences: "preserved",
        owner_actions: "preserved",
        company_memberships: "preserved",
      },
    });
    if (!logged.ok) return json(500, { error: "owner_action_log_failed", details: logged.error.message });

    if (authUpdateError) {
      return json(200, {
        ok: true,
        executed: true,
        warning: "auth_disable_signin_failed",
        warning_details: authUpdateError,
        message: "Usuario archivado, pero no se pudo bloquear acceso en Auth.",
        action: logged.action,
        result: profileAfter,
      });
    }

    return json(200, {
      ok: true,
      executed: true,
      message: "Usuario archivado y acceso bloqueado correctamente.",
      action: logged.action,
      result: profileAfter,
    });
  }

  return json(400, { error: "unsupported_action" });
}
