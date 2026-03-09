import { NextResponse } from "next/server";
import { requireOwner } from "../../../_lib";
import { normalizeOutscraperImport } from "../../_utils/outscraper";

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

function sampleProviderPayload(action: string, row: any) {
  return {
    action,
    external_job_id: row?.external_job_id || null,
    providers: {
      scraping: row?.provider_scraping || null,
      enrichment: row?.provider_enrichment || null,
      sending: row?.provider_sending || null,
    },
    synced_at: new Date().toISOString(),
  };
}

function toObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

export async function GET(_req: Request, ctx: any) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const id = String(ctx?.params?.id || "").trim();
  if (!id) return json(400, { error: "missing_id" });

  const { data, error } = await owner.admin.from("growth_campaigns").select("*").eq("id", id).maybeSingle();
  if (error) return json(400, { error: "growth_campaign_detail_failed", details: error.message });
  if (!data) return json(404, { error: "not_found" });
  return json(200, { campaign: withEconomics(data) });
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

  if (action === "update_costs") {
    const cost_scraping = Number(body?.cost_scraping ?? 0);
    const cost_enrichment = Number(body?.cost_enrichment ?? 0);
    const cost_sending = Number(body?.cost_sending ?? 0);
    const cost_infra = Number(body?.cost_infra ?? 0);
    const customers_converted = Number(body?.customers_converted ?? 0);
    const outcome_note =
      body?.outcome_note === null || body?.outcome_note === undefined
        ? null
        : String(body?.outcome_note || "").trim() || null;

    if (
      ![cost_scraping, cost_enrichment, cost_sending, cost_infra, customers_converted].every(
        (v) => Number.isFinite(v) && v >= 0
      )
    ) {
      return json(400, { error: "invalid_cost_values" });
    }

    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        cost_scraping,
        cost_enrichment,
        cost_sending,
        cost_infra,
        customers_converted: Math.floor(customers_converted),
        outcome_note,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return json(400, { error: "growth_campaign_update_costs_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "update_execution") {
    const provider_scraping =
      body?.provider_scraping === null || body?.provider_scraping === undefined
        ? null
        : String(body?.provider_scraping || "").trim() || null;
    const provider_enrichment =
      body?.provider_enrichment === null || body?.provider_enrichment === undefined
        ? null
        : String(body?.provider_enrichment || "").trim() || null;
    const provider_sending =
      body?.provider_sending === null || body?.provider_sending === undefined
        ? null
        : String(body?.provider_sending || "").trim() || null;
    const external_job_id =
      body?.external_job_id === null || body?.external_job_id === undefined
        ? null
        : String(body?.external_job_id || "").trim() || null;

    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        provider_scraping,
        provider_enrichment,
        provider_sending,
        external_job_id,
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return json(400, { error: "growth_campaign_update_execution_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "save_outscraper_config") {
    const currentConfig = toObject(body?.provider_scraping_config);
    const provider_scraping_config = {
      search_query: String(currentConfig.search_query || "").trim(),
      country: String(currentConfig.country || "").trim(),
      city: String(currentConfig.city || "").trim(),
      limit: Math.max(0, Math.floor(Number(currentConfig.limit || 0))),
      source_type: String(currentConfig.source_type || "google_maps").trim() || "google_maps",
    };

    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        provider_scraping: "outscraper",
        provider_scraping_config,
        provider_scraping_last_status: "configured",
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return json(400, { error: "growth_campaign_save_outscraper_config_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "sync_outscraper") {
    const { data: current, error: curErr } = await owner.admin
      .from("growth_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (curErr) return json(400, { error: "growth_campaign_sync_outscraper_load_failed", details: curErr.message });
    if (!current) return json(404, { error: "not_found" });

    const nextAttempts = Number(current.sync_attempts || 0) + 1;
    const generatedJobId = current.provider_scraping_job_id || `outscraper_${String(current.id).slice(0, 8)}_${Date.now()}`;
    const payload = {
      provider: "outscraper",
      mode: "sync_outscraper",
      config: toObject(current.provider_scraping_config),
      job_id: generatedJobId,
      status: "running",
      synced_at: nowIso,
    };

    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        execution_status: "running",
        provider_scraping: current.provider_scraping || "outscraper",
        provider_scraping_job_id: generatedJobId,
        provider_scraping_last_status: "running",
        last_provider_error: null,
        last_provider_payload: payload,
        last_sync_at: nowIso,
        sync_attempts: nextAttempts,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return json(400, { error: "growth_campaign_sync_outscraper_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "import_outscraper_result") {
    const normalized = normalizeOutscraperImport(toObject(body?.payload));
    const nextLeads = normalized.leads;
    const nextContacts = normalized.contactsFound || normalized.leads;

    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        provider_scraping: "outscraper",
        provider_scraping_job_id: normalized.jobId,
        provider_scraping_last_status: "imported",
        provider_scraping_last_result: normalized.payload,
        provider_scraping_last_cost: normalized.cost,
        provider_scraping_last_leads: normalized.leads,
        leads_discovered: nextLeads,
        contacts_found: nextContacts,
        last_provider_payload: normalized.payload,
        last_provider_error: null,
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return json(400, { error: "growth_campaign_import_outscraper_result_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "mark_outscraper_failed") {
    const reason = String(body?.error_message || "outscraper_sync_failed").trim();
    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        provider_scraping: "outscraper",
        provider_scraping_last_status: "failed",
        last_provider_error: reason,
        execution_status: "failed",
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return json(400, { error: "growth_campaign_mark_outscraper_failed_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "sync_now") {
    const { data: current, error: curErr } = await owner.admin
      .from("growth_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (curErr) return json(400, { error: "growth_campaign_sync_now_load_failed", details: curErr.message });
    if (!current) return json(404, { error: "not_found" });

    const nextAttempts = Number(current.sync_attempts || 0) + 1;
    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        execution_status: "running",
        sync_attempts: nextAttempts,
        last_sync_at: nowIso,
        next_sync_at: null,
        last_provider_error: null,
        last_provider_payload: sampleProviderPayload("sync_now", current),
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return json(400, { error: "growth_campaign_sync_now_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "retry_sync") {
    const { data: current, error: curErr } = await owner.admin
      .from("growth_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (curErr) return json(400, { error: "growth_campaign_retry_sync_load_failed", details: curErr.message });
    if (!current) return json(404, { error: "not_found" });

    const nextAttempts = Number(current.sync_attempts || 0) + 1;
    const nextSync = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        execution_status: "queued",
        sync_attempts: nextAttempts,
        last_sync_at: nowIso,
        next_sync_at: nextSync,
        last_provider_error: null,
        last_provider_payload: sampleProviderPayload("retry_sync", current),
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return json(400, { error: "growth_campaign_retry_sync_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "mark_failed") {
    const reason = String(body?.error_message || body?.last_provider_error || "manual_mark_failed").trim();
    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        execution_status: "failed",
        last_provider_error: reason,
        last_sync_at: nowIso,
        next_sync_at: null,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return json(400, { error: "growth_campaign_mark_failed_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "refresh_metrics") {
    const { data: current, error: curErr } = await owner.admin
      .from("growth_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (curErr) return json(400, { error: "growth_campaign_refresh_metrics_load_failed", details: curErr.message });
    if (!current) return json(404, { error: "not_found" });

    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        last_sync_at: nowIso,
        next_sync_at: null,
        last_provider_payload: sampleProviderPayload("refresh_metrics", current),
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return json(400, { error: "growth_campaign_refresh_metrics_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "queue_execution") {
    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        execution_status: "queued",
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return json(400, { error: "growth_campaign_queue_execution_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "start_execution") {
    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        execution_status: "running",
        execution_started_at: nowIso,
        execution_finished_at: null,
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return json(400, { error: "growth_campaign_start_execution_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "pause_execution") {
    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        execution_status: "paused",
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return json(400, { error: "growth_campaign_pause_execution_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
  }

  if (action === "complete_execution") {
    const { data, error } = await owner.admin
      .from("growth_campaigns")
      .update({
        execution_status: "completed",
        execution_finished_at: nowIso,
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return json(400, { error: "growth_campaign_complete_execution_failed", details: error.message });
    if (!data) return json(404, { error: "not_found" });
    return json(200, { campaign: withEconomics(data) });
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
        execution_status: "idle",
        provider_scraping: source.provider_scraping || null,
        provider_enrichment: source.provider_enrichment || null,
        provider_sending: source.provider_sending || null,
        external_job_id: null,
        last_sync_at: null,
        execution_started_at: null,
        execution_finished_at: null,
        cost_scraping: Number(source.cost_scraping || 0),
        cost_enrichment: Number(source.cost_enrichment || 0),
        cost_sending: Number(source.cost_sending || 0),
        cost_infra: Number(source.cost_infra || 0),
        customers_converted: Number(source.customers_converted || 0),
        metadata: {
          ...(source.metadata || {}),
          duplicated_from: source.id,
        },
      })
      .select("*")
      .single();

    if (dupErr) return json(400, { error: "growth_campaign_duplicate_failed", details: dupErr.message });
    return json(200, { campaign: withEconomics(dup) });
  }

  return json(400, { error: "invalid_action" });
}
