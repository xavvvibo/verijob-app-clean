import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireJobSecret(req: Request) {
  const expected = process.env.CV_PARSE_JOB_SECRET;
  if (!expected) throw new Error("Missing CV_PARSE_JOB_SECRET");
  const got = req.headers.get("x-job-secret");
  return Boolean(got && got === expected);
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  // NO imports pesados aquí; debe responder siempre
  return NextResponse.json({ ok: true, route: "/api/jobs/cv-parse", runtime: "nodejs", methods: ["POST"] });
}

export async function POST(req: Request) {
  try {
    if (!requireJobSecret(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    // Imports dinámicos para evitar crash al cargar la route
    const [{ extractCvTextFromBuffer }, { extractStructuredFromCvText }] = await Promise.all([
      import("@/utils/cv/extractText"),
      import("@/utils/cv/openaiExtract"),
    ]);

    const supabase = getServiceSupabase();

    const { data: jobs, error: pickErr } = await supabase
      .from("cv_parse_jobs")
      .select("id,cv_upload_id,created_at")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1);

    if (pickErr) return NextResponse.json({ error: "pick_failed", details: pickErr.message }, { status: 400 });
    if (!jobs || jobs.length === 0) return NextResponse.json({ ok: true, message: "no_jobs" });

    const job = jobs[0];

    const { error: markErr } = await supabase
      .from("cv_parse_jobs")
      .update({ status: "processing", started_at: new Date().toISOString(), error: null })
      .eq("id", job.id);

    if (markErr) return NextResponse.json({ error: "mark_processing_failed", details: markErr.message }, { status: 400 });

    const { data: upload, error: upErr } = await supabase
      .from("cv_uploads")
      .select("storage_bucket,storage_path,mime_type")
      .eq("id", job.cv_upload_id)
      .single();

    if (upErr) throw new Error(`cv_uploads_read_failed: ${upErr.message}`);

    const bucket = upload.storage_bucket || "candidate-cv";
    const path = upload.storage_path;

    const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !file) throw new Error(`storage_download_failed: ${dlErr?.message || "no_file"}`);

    const buf = Buffer.from(await file.arrayBuffer());
    const text = await extractCvTextFromBuffer(buf, upload.mime_type || null);
    if (!text || text.length < 50) throw new Error("cv_text_too_short");

    const out = await extractStructuredFromCvText(text);

    const { error: saveErr } = await supabase
      .from("cv_parse_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        model: out.model ?? null,
        tokens_in: out.tokensIn ?? null,
        tokens_out: out.tokensOut ?? null,
        result_json: out.result as any,
      })
      .eq("id", job.id);

    if (saveErr) throw new Error(`save_result_failed: ${saveErr.message}`);

    return NextResponse.json({ ok: true, job_id: job.id, status: "succeeded" });
  } catch (e: any) {
    return NextResponse.json({ error: "worker_failed", details: String(e?.message || e) }, { status: 500 });
  }
}
