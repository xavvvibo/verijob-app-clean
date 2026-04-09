import { NextResponse } from "next/server";
import { addDaysIso, parseDurationDays, requireOwner } from "../../../_lib";
import {
  buildOwnerMarketingMetadata,
  normalizeOwnerMarketingSurface,
  readOwnerMarketingMetadata,
  resolveOwnerMarketingLifecycle,
} from "@/lib/owner/marketing-promotions";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function resolveId(ctx: any) {
  const params = await Promise.resolve(ctx?.params);
  return String(params?.id || "").trim();
}

export async function GET(_req: Request, ctx: any) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const id = await resolveId(ctx);
  if (!id) return json(400, { error: "missing_id" });

  const { data, error } = await owner.admin.from("promo_codes").select("*").eq("id", id).maybeSingle();
  if (error) return json(400, { error: "promo_code_detail_failed", details: error.message });
  if (!data) return json(404, { error: "not_found" });
  return json(200, { promo_code: data });
}

async function loadPromo(owner: { admin: any }, id: string) {
  const { data, error } = await owner.admin.from("promo_codes").select("*").eq("id", id).maybeSingle();
  if (error) return { error };
  if (!data) return { notFound: true as const };
  return { data };
}

export async function PATCH(req: Request, ctx: any) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const id = await resolveId(ctx);
  if (!id) return json(400, { error: "missing_id" });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();

  const loaded = await loadPromo(owner, id);
  if ("error" in loaded && loaded.error) return json(400, { error: "promo_code_detail_failed", details: loaded.error.message });
  if ("notFound" in loaded) return json(404, { error: "not_found" });
  const source = loaded.data;
  const lifecycle = resolveOwnerMarketingLifecycle(source);
  const sourceMeta = readOwnerMarketingMetadata(source.metadata);

  if (action === "update") {
    if (lifecycle !== "draft") {
      return json(400, { error: "promo_code_update_only_allowed_for_draft" });
    }

    const target_type = String(body?.target_type || "").trim();
    const benefit_type = String(body?.benefit_type || "").trim();
    const benefit_value = String(body?.benefit_value || "").trim() || null;
    const duration_option = String(body?.duration_option || "").trim();
    const application_surface = normalizeOwnerMarketingSurface(body?.application_surface);
    const custom_expires_at = String(body?.custom_expires_at || "").trim();
    const max_redemptions =
      body?.max_redemptions === null || body?.max_redemptions === undefined || body?.max_redemptions === ""
        ? null
        : Number(body.max_redemptions);

    if (!target_type || !benefit_type) {
      return json(400, { error: "missing_required_fields" });
    }

    const duration_days = parseDurationDays(duration_option);
    let expires_at = duration_option === "sin_caducidad" ? null : addDaysIso(duration_days);
    if (duration_option === "fecha_personalizada" && custom_expires_at) {
      const parsed = Date.parse(custom_expires_at);
      expires_at = Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
    }

    const { data, error } = await owner.admin
      .from("promo_codes")
      .update({
        target_type,
        benefit_type,
        benefit_value,
        duration_days,
        expires_at,
        max_redemptions: Number.isFinite(max_redemptions) ? max_redemptions : null,
        metadata: buildOwnerMarketingMetadata({
          existing: source.metadata,
          lifecycleStatus: "draft",
          applicationSurface: application_surface,
          executionConnected: false,
        }),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return json(400, { error: "promo_code_update_failed", details: error.message });
    return json(200, { promo_code: data });
  }

  if (action === "activate") {
    if (lifecycle === "archived" || lifecycle === "finalized") {
      return json(400, { error: "promo_code_activation_not_allowed" });
    }

    const now = new Date().toISOString();
    const executionConnected = Boolean(sourceMeta.execution_connected);
    const nextLifecycle = executionConnected ? "active" : "configured";
    const { data, error } = await owner.admin
      .from("promo_codes")
      .update({
        starts_at: source.starts_at || now,
        is_active: executionConnected,
        metadata: buildOwnerMarketingMetadata({
          existing: source.metadata,
          lifecycleStatus: nextLifecycle,
          applicationSurface: sourceMeta.application_surface,
          executionConnected,
          activatedAt: now,
        }),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return json(400, { error: "promo_code_activate_failed", details: error.message });
    return json(200, { promo_code: data });
  }

  if (action === "pause" || action === "deactivate") {
    if (!["configured", "active", "paused"].includes(lifecycle)) {
      return json(400, { error: "promo_code_pause_not_allowed" });
    }

    const { data, error } = await owner.admin
      .from("promo_codes")
      .update({
        is_active: false,
        metadata: buildOwnerMarketingMetadata({
          existing: source.metadata,
          lifecycleStatus: "paused",
          applicationSurface: sourceMeta.application_surface,
          executionConnected: false,
          pausedAt: new Date().toISOString(),
        }),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return json(400, { error: "promo_code_pause_failed", details: error.message });
    return json(200, { promo_code: data });
  }

  if (action === "archive") {
    const { data, error } = await owner.admin
      .from("promo_codes")
      .update({
        is_active: false,
        metadata: buildOwnerMarketingMetadata({
          existing: source.metadata,
          lifecycleStatus: "archived",
          applicationSurface: sourceMeta.application_surface,
          executionConnected: false,
          archivedAt: new Date().toISOString(),
        }),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return json(400, { error: "promo_code_archive_failed", details: error.message });
    return json(200, { promo_code: data });
  }

  if (action === "extend") {
    const addDays = Number(body?.add_days || 0);
    if (!Number.isFinite(addDays) || addDays <= 0) return json(400, { error: "invalid_add_days" });
    const base = source.expires_at ? new Date(source.expires_at).getTime() : Date.now();
    const next = new Date(base + addDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await owner.admin
      .from("promo_codes")
      .update({
        expires_at: next,
        metadata: buildOwnerMarketingMetadata({
          existing: source.metadata,
          lifecycleStatus: lifecycle === "draft" ? "draft" : "configured",
          applicationSurface: sourceMeta.application_surface,
          executionConnected: Boolean(sourceMeta.execution_connected),
        }),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return json(400, { error: "promo_code_extend_failed", details: error.message });
    return json(200, { promo_code: data });
  }

  if (action === "duplicate") {
    const duplicatedCode = `${String(source.code || "VJ").toUpperCase()}-COPY`;
    const { data: dup, error: dupErr } = await owner.admin
      .from("promo_codes")
      .insert({
        code: duplicatedCode,
        target_type: source.target_type,
        benefit_type: source.benefit_type,
        benefit_value: source.benefit_value,
        duration_days: source.duration_days,
        starts_at: null,
        expires_at: source.expires_at,
        max_redemptions: source.max_redemptions,
        current_redemptions: 0,
        is_active: false,
        campaign_type: source.campaign_type,
        metadata: buildOwnerMarketingMetadata({
          existing: source.metadata,
          lifecycleStatus: "draft",
          applicationSurface: sourceMeta.application_surface,
          executionConnected: false,
          duplicatedFrom: source.id,
        }),
        created_by: owner.ownerId,
      })
      .select("*")
      .single();

    if (dupErr) return json(400, { error: "promo_code_duplicate_failed", details: dupErr.message });
    return json(200, { promo_code: dup });
  }

  return json(400, { error: "invalid_action" });
}

export async function DELETE(_req: Request, ctx: any) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const id = await resolveId(ctx);
  if (!id) return json(400, { error: "missing_id" });

  const loaded = await loadPromo(owner, id);
  if ("error" in loaded && loaded.error) return json(400, { error: "promo_code_detail_failed", details: loaded.error.message });
  if ("notFound" in loaded) return json(404, { error: "not_found" });

  const promo = loaded.data;
  const lifecycle = resolveOwnerMarketingLifecycle(promo);
  if (lifecycle !== "draft" || Number(promo.current_redemptions || 0) > 0) {
    return json(400, { error: "promo_code_delete_only_allowed_for_unused_draft" });
  }

  const { error } = await owner.admin.from("promo_codes").delete().eq("id", id);
  if (error) return json(400, { error: "promo_code_delete_failed", details: error.message });
  return json(200, { ok: true });
}
