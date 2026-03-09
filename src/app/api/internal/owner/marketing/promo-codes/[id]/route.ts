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

  const { data, error } = await owner.admin.from("promo_codes").select("*").eq("id", id).maybeSingle();
  if (error) return json(400, { error: "promo_code_detail_failed", details: error.message });
  if (!data) return json(404, { error: "not_found" });
  return json(200, { promo_code: data });
}

export async function PATCH(req: Request, ctx: any) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const id = String(ctx?.params?.id || "").trim();
  if (!id) return json(400, { error: "missing_id" });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();

  if (action === "deactivate") {
    const { error } = await owner.admin
      .from("promo_codes")
      .update({ is_active: false })
      .eq("id", id);
    if (error) return json(400, { error: "promo_code_deactivate_failed", details: error.message });
    return json(200, { ok: true });
  }

  if (action === "extend") {
    const addDays = Number(body?.add_days || 0);
    if (!Number.isFinite(addDays) || addDays <= 0) return json(400, { error: "invalid_add_days" });

    const { data: row, error: rowErr } = await owner.admin
      .from("promo_codes")
      .select("id,expires_at")
      .eq("id", id)
      .maybeSingle();
    if (rowErr) return json(400, { error: "promo_code_extend_source_failed", details: rowErr.message });
    if (!row) return json(404, { error: "not_found" });

    const base = row.expires_at ? new Date(row.expires_at).getTime() : Date.now();
    const next = new Date(base + addDays * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await owner.admin
      .from("promo_codes")
      .update({ expires_at: next, is_active: true })
      .eq("id", id);
    if (error) return json(400, { error: "promo_code_extend_failed", details: error.message });
    return json(200, { ok: true });
  }

  if (action === "duplicate") {
    const { data: source, error: srcErr } = await owner.admin
      .from("promo_codes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (srcErr) return json(400, { error: "promo_code_duplicate_source_failed", details: srcErr.message });
    if (!source) return json(404, { error: "not_found" });

    const duplicatedCode = `${String(source.code || "VJ").toUpperCase()}-COPY`;
    const { data: dup, error: dupErr } = await owner.admin
      .from("promo_codes")
      .insert({
        code: duplicatedCode,
        target_type: source.target_type,
        benefit_type: source.benefit_type,
        benefit_value: source.benefit_value,
        duration_days: source.duration_days,
        starts_at: new Date().toISOString(),
        expires_at: source.expires_at,
        max_redemptions: source.max_redemptions,
        current_redemptions: 0,
        is_active: true,
        campaign_type: source.campaign_type,
        metadata: {
          ...(source.metadata || {}),
          duplicated_from: source.id,
        },
        created_by: owner.ownerId,
      })
      .select("*")
      .single();

    if (dupErr) return json(400, { error: "promo_code_duplicate_failed", details: dupErr.message });
    return json(200, { promo_code: dup });
  }

  return json(400, { error: "invalid_action" });
}
