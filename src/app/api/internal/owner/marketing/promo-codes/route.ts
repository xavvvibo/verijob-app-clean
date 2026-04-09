import { NextResponse } from "next/server";
import { addDaysIso, genPromoCode, parseDurationDays, requireOwner } from "../../_lib";
import { buildOwnerMarketingMetadata, normalizeOwnerMarketingSurface } from "@/lib/owner/marketing-promotions";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const { data, error } = await owner.admin
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return json(400, { error: "promo_codes_query_failed", details: error.message });
  return json(200, { promo_codes: data || [] });
}

export async function POST(req: Request) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const body = await req.json().catch(() => ({}));
  const target_type = String(body?.target_type || "").trim();
  const benefit_type = String(body?.benefit_type || "").trim();
  const benefit_value = String(body?.benefit_value || "").trim() || null;
  const duration_option = String(body?.duration_option || "").trim();
  const max_redemptions = body?.max_redemptions === null || body?.max_redemptions === undefined || body?.max_redemptions === "" ? null : Number(body.max_redemptions);
  const code_mode = String(body?.code_mode || "autogen").trim();
  const custom_code = String(body?.custom_code || "").trim();
  const campaign_type = String(body?.campaign_type || "campaign").trim();
  const custom_expires_at = String(body?.custom_expires_at || "").trim();
  const application_surface = normalizeOwnerMarketingSurface(body?.application_surface);

  if (!target_type || !benefit_type) {
    return json(400, { error: "missing_required_fields" });
  }

  const duration_days = parseDurationDays(duration_option);
  let expires_at = duration_option === "sin_caducidad" ? null : addDaysIso(duration_days);
  if (duration_option === "fecha_personalizada" && custom_expires_at) {
    const parsed = Date.parse(custom_expires_at);
    expires_at = Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  const code = code_mode === "custom" && custom_code ? custom_code.toUpperCase() : genPromoCode("VJ");

  const { data, error } = await owner.admin
    .from("promo_codes")
    .insert({
      code,
      target_type,
      benefit_type,
      benefit_value,
      duration_days,
      starts_at: null,
      expires_at,
      max_redemptions: Number.isFinite(max_redemptions) ? max_redemptions : null,
      current_redemptions: 0,
      is_active: false,
      campaign_type,
      metadata: buildOwnerMarketingMetadata({
        lifecycleStatus: "draft",
        applicationSurface: application_surface,
        executionConnected: false,
        source: "owner_marketing_builder",
      }),
      created_by: owner.ownerId,
    })
    .select("*")
    .single();

  if (error) return json(400, { error: "promo_code_create_failed", details: error.message });
  return json(200, { promo_code: data });
}
