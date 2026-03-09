import { NextResponse } from "next/server";
import { requireOwner } from "../../_lib";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function withEconomics(row: any) {
  const cost_scraping = Number(row?.cost_scraping || 0);
  const cost_enrichment = Number(row?.cost_enrichment || 0);
  const cost_sending = Number(row?.cost_sending || 0);
  const cost_infra = Number(row?.cost_infra || 0);
  const leads_discovered = Number(row?.leads_discovered || 0);
  const demos_count = Number(row?.demos_count || 0);
  const customers_converted = Number(row?.customers_converted || 0);

  const total_cost = cost_scraping + cost_enrichment + cost_sending + cost_infra;
  const cost_per_lead = leads_discovered > 0 ? total_cost / leads_discovered : 0;
  const cost_per_demo = demos_count > 0 ? total_cost / demos_count : 0;
  const cost_per_customer = customers_converted > 0 ? total_cost / customers_converted : 0;

  return {
    ...row,
    total_cost,
    cost_per_lead,
    cost_per_demo,
    cost_per_customer,
  };
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
  return json(200, { campaigns: Array.isArray(data) ? data.map(withEconomics) : [] });
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
  const cost_scraping = Number(body?.cost_scraping || 0);
  const cost_enrichment = Number(body?.cost_enrichment || 0);
  const cost_sending = Number(body?.cost_sending || 0);
  const cost_infra = Number(body?.cost_infra || 0);
  const customers_converted = Number(body?.customers_converted || 0);

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
      execution_status: "idle",
      launched_at: launchNow ? nowIso : null,
      cost_scraping: Number.isFinite(cost_scraping) && cost_scraping >= 0 ? cost_scraping : 0,
      cost_enrichment: Number.isFinite(cost_enrichment) && cost_enrichment >= 0 ? cost_enrichment : 0,
      cost_sending: Number.isFinite(cost_sending) && cost_sending >= 0 ? cost_sending : 0,
      cost_infra: Number.isFinite(cost_infra) && cost_infra >= 0 ? cost_infra : 0,
      customers_converted:
        Number.isFinite(customers_converted) && customers_converted >= 0
          ? Math.floor(customers_converted)
          : 0,
      metadata: {
        source: "owner_growth_builder",
      },
    })
    .select("*")
    .single();

  if (error) return json(400, { error: "growth_campaign_create_failed", details: error.message });
  return json(200, { campaign: withEconomics(data) });
}
