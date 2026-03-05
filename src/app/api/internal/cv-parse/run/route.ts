import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    null
  );
}
function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}
function getAdminSecret(): string {
  return process.env.INTERNAL_ADMIN_SECRET || "";
}
function getOpenAIKey(): string | null {
  return process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || null;
}

async function openaiExtractStructuredCvFromText(text: string) {
  const apiKey = getOpenAIKey();
  if (!apiKey) return { ok: false as const, error: "missing_openai_api_key" };

  const model = process.env.OPENAI_CV_MODEL || "gpt-4o-mini";

  const system = [
    "You extract structured CV data from raw text.",
    "Return ONLY valid JSON, no markdown, no commentary.",
    "Schema:",
    "{",
    '  "experiences": [',
    "    {",
    '      "company": string|null,',
    '      "title": string|null,',
    '      "start_date": "YYYY-MM-DD"|null,',
    '      "end_date": "YYYY-MM-DD"|null',
    "    }",
    "  ]",
    "}"
  ].join("\n");

  const user = ["Extract the CV experiences from this text.", "Text:", text.slice(0, 120_000)].join("\n\n");

  const body = {
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.1
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return {
      ok: false as const,
      error: "openai_failed",
      status: r.status,
      details: t.slice(0, 2000)
    };
  }

  const j: any = await r.json();
  const content = j?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return { ok: false as const, error: "openai_no_content" };

  let result: any;
  try { result = JSON.parse(content); } catch {
    return { ok: false as const, error: "openai_invalid_json", details: content.slice(0, 2000) };
  }

  if (!result || typeof result !== "object") result = {};
  if (!Array.isArray(result.experiences)) result.experiences = [];

  result.experiences = result.experiences.map((e: any) => ({
    company: typeof e?.company === "string" ? e.company : (typeof e?.employer === "string" ? e.employer : null),
    title: typeof e?.title === "string" ? e.title : (typeof e?.role === "string" ? e.role : null),
    start_date: typeof e?.start_date === "string" ? e.start_date : (typeof e?.from === "string" ? e.from : null),
    end_date: typeof e?.end_date === "string" ? e.end_date : (typeof e?.to === "string" ? e.to : null)
  }));

  return {
    ok: true as const,
    result_json: result,
    tokens_in: j?.usage?.prompt_tokens ?? null,
    tokens_out: j?.usage?.completion_tokens ?? null,
    model
  };
}

async function extractTextFromPdf(buf: Buffer) {
  // Prefer pdf-parse-debugging-disabled (ya lo tienes en deps) para evitar DOMMatrix
  try {
    const mod: any = await import("pdf-parse-debugging-disabled");
    const fn: any = mod?.default || mod;
    const parsed: any = await fn(buf);
    const text = (parsed?.text || "").trim();
    if (text) return { ok: true as const, text, engine: "pdf-parse-debugging-disabled" };
    return { ok: false as const, error: "empty_pdf_text", engine: "pdf-parse-debugging-disabled" };
  } catch (e: any) {
    const msg = String(e?.message || e);
    return { ok: false as const, error: `pdf_text_extract_failed: ${msg}`.slice(0, 900), engine: "pdf-parse-debugging-disabled" };
  }
}

export async function GET() {
  return NextResponse.json({ route_version: "cv-parse-runner-v6", ok: true });
}

export async function POST(req: Request) {
  const adminSecret = getAdminSecret();
  const hdr = req.headers.get("x-internal-secret") || "";
  if (!adminSecret || hdr !== adminSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getServiceKey();
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "missing_server_env" }, { status: 500 });
  }

  const supabase: any = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const payload: any = await req.json().catch(() => ({}));
  const jobId: string | null = typeof payload?.job_id === "string" ? payload.job_id : null;
  if (!jobId) return NextResponse.json({ error: "missing_job_id" }, { status: 400 });

  const { data: job, error: jobErr } = await supabase
    .from("cv_parse_jobs")
    .select("id,user_id,cv_upload_id,status")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: "job_query_failed", details: jobErr.message }, { status: 400 });
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });

  await supabase.from("cv_parse_jobs").update({
    status: "processing",
    started_at: new Date().toISOString(),
    error: null
  }).eq("id", job.id);

  const { data: upload, error: upErr } = await supabase
    .from("cv_uploads")
    .select("id,user_id,storage_bucket,storage_path,original_filename,mime_type")
    .eq("id", job.cv_upload_id)
    .maybeSingle();

  if (upErr || !upload) {
    await supabase.from("cv_parse_jobs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: upErr?.message || "cv_upload_not_found"
    }).eq("id", job.id);

    return NextResponse.json({ route_version: "cv-parse-runner-v6", processed_job_id: job.id, status: "failed", error: upErr?.message || "cv_upload_not_found" });
  }

  const { data: file, error: dlErr } = await supabase.storage.from(upload.storage_bucket).download(upload.storage_path);
  if (dlErr || !file) {
    await supabase.from("cv_parse_jobs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: dlErr?.message || "storage_download_failed"
    }).eq("id", job.id);

    return NextResponse.json({ route_version: "cv-parse-runner-v6", processed_job_id: job.id, status: "failed", error: dlErr?.message || "storage_download_failed" });
  }

  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);

  const extractedText = await extractTextFromPdf(buf);
  if (!extractedText.ok) {
    await supabase.from("cv_parse_jobs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: `${extractedText.engine}: ${extractedText.error}`.slice(0, 2000)
    }).eq("id", job.id);

    return NextResponse.json({
      route_version: "cv-parse-runner-v6",
      processed_job_id: job.id,
      status: "failed",
      error: "pdf_text_extract_failed",
      engine: extractedText.engine,
      details: extractedText.error
    });
  }

  const extracted = await openaiExtractStructuredCvFromText(extractedText.text);
  if (!extracted.ok) {
    await supabase.from("cv_parse_jobs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: `${extracted.error}${(extracted as any).status ? `(${(extracted as any).status})` : ""}${(extracted as any).details ? `: ${(extracted as any).details}` : ""}`.slice(0, 2000)
    }).eq("id", job.id);

    return NextResponse.json({
      route_version: "cv-parse-runner-v6",
      processed_job_id: job.id,
      status: "failed",
      error: extracted.error,
      status_code: (extracted as any).status || null,
      details: (extracted as any).details || null,
      engine: extractedText.engine
    });
  }

  await supabase.from("cv_parse_jobs").update({
    status: "succeeded",
    finished_at: new Date().toISOString(),
    result_json: extracted.result_json,
    model: extracted.model,
    tokens_in: extracted.tokens_in,
    tokens_out: extracted.tokens_out,
    error: null
  }).eq("id", job.id);

  const experiences = Array.isArray(extracted.result_json?.experiences) ? extracted.result_json.experiences : [];
  const experiencesCount = experiences.length;

  const { data: cvUpsert, error: cvErr } = await supabase
    .from("candidate_cvs")
    .upsert({
      user_id: job.user_id,
      structured_cv_json: extracted.result_json,
      experiences_count: experiencesCount,
      last_parsed_at: new Date().toISOString()
    }, { onConflict: "user_id" })
    .select("id,user_id")
    .maybeSingle();

  if (cvErr || !cvUpsert) {
    return NextResponse.json({
      route_version: "cv-parse-runner-v6",
      processed_job_id: job.id,
      status: "succeeded_but_materialize_failed",
      error: cvErr?.message || "candidate_cvs_upsert_failed"
    }, { status: 200 });
  }

  for (let i = 0; i < experiences.length; i++) {
    const e = experiences[i] || {};
    await supabase.from("candidate_cv_experiences").upsert({
      cv_id: cvUpsert.id,
      user_id: job.user_id,
      exp_index: i,
      company_name: typeof e.company === "string" ? e.company : null,
      role_title: typeof e.title === "string" ? e.title : null,
      start_date: typeof e.start_date === "string" ? e.start_date : null,
      end_date: typeof e.end_date === "string" ? e.end_date : null,
      raw_json: e,
      updated_at: new Date().toISOString()
    }, { onConflict: "cv_id,exp_index" });
  }

  return NextResponse.json({
    route_version: "cv-parse-runner-v6",
    processed_job_id: job.id,
    status: "succeeded",
    experiences_count: experiencesCount,
    engine: extractedText.engine
  });
}
