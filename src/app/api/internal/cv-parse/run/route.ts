import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

function getServiceKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    null
  );
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = getServiceKey();
  const adminSecret = process.env.INTERNAL_ADMIN_SECRET || "";

  const hdr = req.headers.get("x-internal-secret") || "";
  if (!adminSecret || hdr !== adminSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "missing_server_env", has_url: !!supabaseUrl, has_service_key: !!serviceKey }, { status: 500 });
  }

  const supabase = createSupabaseAdmin(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) pick one queued job (you can loop later)
  const { data: job, error: jobErr } = await supabase
    .from("cv_parse_jobs")
    .select("id,user_id,cv_upload_id,status")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: "job_query_failed", details: jobErr.message }, { status: 400 });
  if (!job) return NextResponse.json({ ok: true, message: "no_queued_jobs" });

  // mark processing
  await supabase.from("cv_parse_jobs").update({ status: "processing", started_at: new Date().toISOString(), error: null }).eq("id", job.id);

  // TODO: here we will:
  // - load the uploaded file using cv_upload_id (need the table/columns + storage bucket/path)
  // - call OpenAI to extract structured CV JSON
  // - update cv_parse_jobs.result_json + tokens + status='succeeded' OR status='failed' with error
  //
  // For now: fail explicitly with actionable message
  await supabase.from("cv_parse_jobs").update({
    status: "failed",
    finished_at: new Date().toISOString(),
    error: "cv_upload_id wiring missing: need source table+storage path to fetch the PDF"
  }).eq("id", job.id);

  return NextResponse.json({ route_version: "cv-parse-runner-v1", processed_job_id: job.id, status: "failed_needs_cv_upload_wiring" });
}
