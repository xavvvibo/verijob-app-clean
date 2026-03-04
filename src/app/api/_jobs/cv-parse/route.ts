import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import { extractCvTextFromBuffer } from "@/utils/cv/extractText";
import { extractStructuredFromCvText } from "@/utils/openai_cv_extract";

export const runtime = "nodejs";

const BodySchema = z.object({
  job_id: z.string().uuid(),
});

function requireInternal(req: Request) {
  const token = req.headers.get("x-verijob-internal") || "";
  const expected = process.env.INTERNAL_JOB_TOKEN || "";
  // si no configuras token, al menos bloquea por defecto
  if (!expected || token !== expected) return false;
  return true;
}

export async function POST(req: Request) {
  if (!requireInternal(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminSupabaseClient();

  // 1) carga job + upload
  const { data: job, error: jErr } = await admin
    .from("cv_parse_jobs")
    .select("id,status,user_id,cv_upload_id,cv_uploads:cv_upload_id(id,storage_bucket,storage_path,mime_type)")
    .eq("id", parsed.data.job_id)
    .maybeSingle();

  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 400 });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (job.status === "processing" || job.status === "succeeded") {
    return NextResponse.json({ ok: true, status: job.status }, { status: 200 });
  }

  // 2) marca processing
  await admin
    .from("cv_parse_jobs")
    .update({ status: "processing", started_at: new Date().toISOString(), error: null })
    .eq("id", job.id);

  try {
    const upload: any = (job as any).cv_uploads;
    const bucket = upload.storage_bucket as string;
    const path = upload.storage_path as string;
    const mimeType = upload.mime_type as (string | null);

    // 3) download desde Supabase Storage (service role)
    const { data: dl, error: dlErr } = await admin.storage.from(bucket).download(path);
    if (dlErr || !dl) throw new Error(dlErr?.message || "storage_download_failed");

    const arrayBuf = await dl.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // 4) extract text
    const cvText = await extractCvTextFromBuffer(buf, mimeType);
    if (!cvText || cvText.length < 80) throw new Error("cv_text_too_short_or_empty");

    // 5) LLM structured extraction
    const out = await extractStructuredFromCvText(cvText);

    // 6) persist result
    await admin
      .from("cv_parse_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        model: out.model || null,
        tokens_in: out.tokensIn ?? null,
        tokens_out: out.tokensOut ?? null,
        result_json: out.result,
        error: null,
      })
      .eq("id", job.id);

    return NextResponse.json({ ok: true, status: "succeeded" }, { status: 200 });
  } catch (e: any) {
    await admin
      .from("cv_parse_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: String(e?.message || e),
      })
      .eq("id", parsed.data.job_id);

    return NextResponse.json({ ok: false, status: "failed", error: String(e?.message || e) }, { status: 200 });
  }
}
