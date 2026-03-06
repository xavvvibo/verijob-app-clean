import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { z } from "zod";

const BodySchema = z.object({
  storage_path: z.string().min(1),
  original_filename: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  sha256: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const supabase = await createRouteHandlerClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const body = BodySchema.parse(json);

    const { data: upload, error: upErr } = await supabase
      .from("cv_uploads")
      .insert({
        user_id: user.id,
        storage_bucket: "candidate-cv",
        storage_path: body.storage_path,
        original_filename: body.original_filename ?? null,
        mime_type: body.mime_type ?? null,
        size_bytes: body.size_bytes ?? null,
        sha256: body.sha256 ?? null,
      })
      .select("id,user_id,storage_bucket,storage_path")
      .single();

    if (upErr) {
      return NextResponse.json(
        { error: "cv_uploads_insert_failed", details: upErr.message, user_id: user.id },
        { status: 400 }
      );
    }

    const { data: job, error: jobErr } = await supabase
      .from("cv_parse_jobs")
      .insert({
        user_id: user.id,
        cv_upload_id: upload.id,
        status: "queued",
      })
      .select("id,status,created_at")
      .single();

    if (jobErr) {
      return NextResponse.json(
        { error: "cv_parse_jobs_insert_failed", details: jobErr.message, user_id: user.id, cv_upload_id: upload.id },
        { status: 400 }
      );
    }

    return NextResponse.json({
      job_id: job.id,
      status: job.status,
      created_at: job.created_at,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "bad_request", details: String(e?.message || e) },
      { status: 400 }
    );
  }
}
