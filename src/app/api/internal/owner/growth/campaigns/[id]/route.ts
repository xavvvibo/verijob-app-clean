import { NextResponse } from "next/server";
import { requireOwner } from "../../../_lib";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(_req: Request, ctx: any) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const id = String(ctx?.params?.id || "").trim();
  if (!id) return json(400, { error: "missing_id" });

  const { data, error } = await owner.admin.from("growth_campaigns").select("*").eq("id", id).maybeSingle();
  if (error) return json(400, { error: "growth_campaign_detail_failed", details: error.message });
  if (!data) return json(404, { error: "not_found" });
  return json(200, { campaign: data });
}

export async function PATCH(req: Request, ctx: any) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const id = String(ctx?.params?.id || "").trim();
  if (!id) return json(400, { error: "missing_id" });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  const nowIso = new Date().toISOString();

  if (action === "pause") {
    const { error } = await owner.admin
      .from("growth_campaigns")
      .update({ status: "paused", paused_at: nowIso, updated_at: nowIso })
      .eq("id", id);
    if (error) return json(400, { error: "growth_campaign_pause_failed", details: error.message });
    return json(200, { ok: true });
  }

  if (action === "resume") {
    const { error } = await owner.admin
      .from("growth_campaigns")
      .update({ status: "running", paused_at: null, launched_at: nowIso, updated_at: nowIso })
      .eq("id", id);
    if (error) return json(400, { error: "growth_campaign_resume_failed", details: error.message });
    return json(200, { ok: true });
  }

  if (action === "close") {
    const { error } = await owner.admin
      .from("growth_campaigns")
      .update({ status: "closed", closed_at: nowIso, updated_at: nowIso })
      .eq("id", id);
    if (error) return json(400, { error: "growth_campaign_close_failed", details: error.message });
    return json(200, { ok: true });
  }

  if (action === "duplicate") {
    const { data: source, error: srcErr } = await owner.admin
      .from("growth_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (srcErr) return json(400, { error: "growth_campaign_duplicate_source_failed", details: srcErr.message });
    if (!source) return json(404, { error: "not_found" });

    const { data: dup, error: dupErr } = await owner.admin
      .from("growth_campaigns")
      .insert({
        created_by: owner.ownerId,
        objective: source.objective,
        sector: source.sector,
        location_scope: source.location_scope,
        location_value: source.location_value,
        company_size: source.company_size,
        channel: source.channel,
        intensity: source.intensity,
        message_style: source.message_style,
        template_key: source.template_key,
        status: "draft",
        execution_mode: source.execution_mode || "manual",
        orchestration_status: "ready",
        metadata: {
          ...(source.metadata || {}),
          duplicated_from: source.id,
        },
      })
      .select("*")
      .single();

    if (dupErr) return json(400, { error: "growth_campaign_duplicate_failed", details: dupErr.message });
    return json(200, { campaign: dup });
  }

  return json(400, { error: "invalid_action" });
}
