import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  storage_path: z.string().min(1),
  original_filename: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  sha256: z.string().nullable().optional(),
});

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function getServiceKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    null
  );
}

function getInternalSecret(): string {
  return process.env.INTERNAL_ADMIN_SECRET || "";
}

export async function POST(req: Request) {
  try {
    const authClient = await createRouteHandlerClient();

    const {
      data: { user },
      error: authErr,
    } = await authClient.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "unauthorized", details: authErr?.message || null },
        { status: 401 }
      );
    }

    const json = await req.json().catch(() => null);
    const body = BodySchema.parse(json);

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceKey();

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "missing_server_env", has_url: !!supabaseUrl, has_service_key: !!serviceKey },
        { status: 500 }
      );
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: upload, error: upErr } = await admin
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
      .select("id,user_id,storage_bucket,storage_path,created_at")
      .single();

    if (upErr || !upload) {
      return NextResponse.json(
        {
          error: "cv_uploads_insert_failed",
          details: upErr?.message || "insert_failed",
          step: "cv_uploads",
          user_id: user.id,
          storage_path: body.storage_path,
        },
        { status: 400 }
      );
    }

    const { data: job, error: jobErr } = await admin
      .from("cv_parse_jobs")
      .insert({
        user_id: user.id,
        cv_upload_id: upload.id,
        status: "queued",
      })
      .select("id,status,created_at")
      .single();

    if (jobErr || !job) {
      return NextResponse.json(
        {
          error: "cv_parse_jobs_insert_failed",
          details: jobErr?.message || "insert_failed",
          step: "cv_parse_jobs",
          user_id: user.id,
          cv_upload_id: upload.id,
        },
        { status: 400 }
      );
    }

    const origin = new URL(req.url).origin;
    const internalSecret = getInternalSecret();

    let runnerTriggered = false;
    let runnerStatus: number | null = null;
    let runnerError: string | null = null;

    if (internalSecret) {
      try {
        const runnerRes = await fetch(`${origin}/api/candidate/cv/parse/trigger`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-secret": internalSecret,
          },
          body: JSON.stringify({ job_id: job.id }),
          cache: "no-store",
        });

        runnerStatus = runnerRes.status;
        runnerTriggered = runnerRes.ok;

        if (!runnerRes.ok) {
          const txt = await runnerRes.text().catch(() => "");
          runnerError = txt.slice(0, 500) || `runner_failed_${runnerRes.status}`;
        }
      } catch (e: any) {
        runnerError = String(e?.message || e);
      }
    } else {
      runnerError = "missing_internal_admin_secret";
    }

    return NextResponse.json({
      ok: true,
      job_id: job.id,
      status: job.status,
      created_at: job.created_at,
      upload_id: upload.id,
      runner_triggered: runnerTriggered,
      runner_status: runnerStatus,
      runner_error: runnerError,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: String(e?.message || e),
      },
      { status: 400 }
    );
  }
}
