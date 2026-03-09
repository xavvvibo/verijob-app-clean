import { NextResponse } from "next/server";
import { requireOwner } from "../../_lib";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const { data, error } = await owner.admin
    .from("growth_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return json(400, { error: "growth_campaigns_query_failed", details: error.message });
  return json(200, { campaigns: data || [] });
}

export async function POST(req: Request) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const body = await req.json().catch(() => ({}));

  const objective = String(body?.objective || "").trim();
  const sector = String(body?.sector || "").trim();
  const location_scope = String(body?.location_scope || "").trim();
  const location_value = String(body?.location_value || "").trim() || null;
  const company_size = String(body?.company_size || "").trim();
  const channel = String(body?.channel || "").trim();
  const intensity = String(body?.intensity || "").trim();
  const message_style = String(body?.message_style || "").trim();
  const template_key = String(body?.template_key || "").trim() || null;

  if (!objective || !sector || !location_scope || !company_size || !channel || !intensity || !message_style) {
    return json(400, { error: "missing_required_fields" });
  }

  const launchNow = Boolean(body?.launch_now ?? true);
  const nowIso = new Date().toISOString();
  const status = launchNow ? "running" : "draft";

  const { data, error } = await owner.admin
    .from("growth_campaigns")
    .insert({
      created_by: owner.ownerId,
      objective,
      sector,
      location_scope,
      location_value,
      company_size,
      channel,
      intensity,
      message_style,
      template_key,
      status,
      execution_mode: "manual",
      orchestration_status: "ready",
      launched_at: launchNow ? nowIso : null,
      metadata: {
        source: "owner_growth_builder",
      },
    })
    .select("*")
    .single();

  if (error) return json(400, { error: "growth_campaign_create_failed", details: error.message });
  return json(200, { campaign: data });
}
