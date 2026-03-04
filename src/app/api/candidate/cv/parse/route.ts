import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const BodySchema = z.object({
  storage_path: z.string().min(1),
  storage_bucket: z.string().min(1).optional().default("candidate-cv"),
  original_filename: z.string().optional().nullable(),
  mime_type: z.string().optional().nullable(),
  size_bytes: z.number().int().optional().nullable(),
  sha256: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid body", details: body.error.flatten() }, { status: 400 });

  const admin = createAdminSupabaseClient();

  // 1) inserta upload
  const { data: upload, error: upErr } = await admin
    .from("cv_uploads")
    .insert({
      user_id: user.id,
      storage_bucket: body.data.storage_bucket,
      storage_path: body.data.storage_path,
      original_filename: body.data.original_filename ?? null,
      mime_type: body.data.mime_type ?? null,
      size_bytes: body.data.size_bytes ?? null,
      sha256: body.data.sha256 ?? null,
    })
    .select("*")
    .single();

  if (upErr) return NextResponse.json({ error: "cv_upload_insert_failed", details: upErr.message }, { status: 400 });

  // 2) crea job
  const { data: job, error: jobErr } = await admin
    .from("cv_parse_jobs")
    .insert({
      user_id: user.id,
      cv_upload_id: upload.id,
      status: "queued",
    })
    .select("id,status,created_at")
    .single();

  if (jobErr) return NextResponse.json({ error: "cv_job_insert_failed", details: jobErr.message }, { status: 400 });

  // 3) dispara worker (best-effort)
  // Nota: en serverless no hay garantía absoluta de "fire-and-forget",
  // pero en práctica suele completar. Si quieres garantía total, lo pasamos a Edge Function + trigger.
  try {
    const origin = new URL(req.url).origin;
    void fetch(`${origin}/api/_jobs/cv-parse`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-verijob-internal": process.env.INTERNAL_JOB_TOKEN || "",
      },
      body: JSON.stringify({ job_id: job.id }),
      // @ts-ignore keepalive existe en runtime web; Node lo ignora sin romper
      keepalive: true,
    });
  } catch {}

  return NextResponse.json({ job_id: job.id, status: job.status }, { status: 200 });
}
