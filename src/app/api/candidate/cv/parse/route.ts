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

async function markCvParseJobFailed(params: {
  admin: any;
  jobId: string;
  errorMessage: string;
}) {
  const failedAt = new Date().toISOString();
  try {
    await params.admin
      .from("cv_parse_jobs")
      .update({
        status: "failed",
        finished_at: failedAt,
        error: String(params.errorMessage || "cv_parse_dispatch_failed").slice(0, 1000),
        result_json: {
          meta: {
            retryable: true,
            processing_mode: "background_job",
            failed_at: failedAt,
            dispatch_failed: true,
          },
        },
      })
      .eq("id", params.jobId);
    console.error("CV_PARSE_ROUTE_JOB_FAILED_PERSISTED", {
      jobId: params.jobId,
      error: String(params.errorMessage || "cv_parse_dispatch_failed"),
    });
  } catch (persistError: any) {
    console.error("CV_PARSE_ROUTE_JOB_FAILED_PERSIST_FAILED", {
      jobId: params.jobId,
      error: String(params.errorMessage || "cv_parse_dispatch_failed"),
      persistError: String(persistError?.message || persistError),
    });
  }
}

export async function POST(req: Request) {
  let admin: any = null;
  let createdJobId: string | null = null;
  let createdUploadId: string | null = null;
  let debugStage:
    | "enter"
    | "auth"
    | "body"
    | "upload_create"
    | "job_create"
    | "trigger"
    | "response" = "enter";
  try {
    console.info("CV_PARSE_ROUTE_ENTER");
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
    debugStage = "auth";
    console.info("CV_PARSE_ROUTE_AUTH_OK", { userId: user.id });

    const json = await req.json().catch(() => null);
    const body = BodySchema.parse(json);
    debugStage = "body";
    console.info("CV_PARSE_ROUTE_BODY_OK", {
      storagePath: body.storage_path,
      originalFilename: body.original_filename || null,
      mimeType: body.mime_type || null,
      sizeBytes: body.size_bytes ?? null,
    });

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceKey();

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "missing_server_env", has_url: !!supabaseUrl, has_service_key: !!serviceKey },
        { status: 500 }
      );
    }

    admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
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
    debugStage = "upload_create";
    console.info("CV_PARSE_ROUTE_UPLOAD_CREATED", {
      uploadId: upload.id,
      userId: user.id,
      storagePath: body.storage_path,
    });

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
    createdJobId = String(job.id);
    createdUploadId = String(upload.id);
    debugStage = "job_create";
    console.info("CV_PARSE_JOB_CREATED", {
      jobId: job.id,
      userId: user.id,
      uploadId: upload.id,
      storagePath: body.storage_path,
    });
    console.info("CV_PARSE_ROUTE_JOB_CREATED", {
      jobId: job.id,
      uploadId: upload.id,
      userId: user.id,
    });

    const origin = new URL(req.url).origin;
    const internalSecret = getInternalSecret();

    let runnerTriggered = false;
    let runnerStatus: number | null = null;
    let runnerError: string | null = null;

    try {
      debugStage = "trigger";
      console.info("CV_PARSE_ROUTE_TRIGGER_CALL_START", {
        jobId: job.id,
        uploadId: upload.id,
      });
      const cookie = req.headers.get("cookie");
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };

      if (internalSecret) headers["x-internal-secret"] = internalSecret;
      if (cookie) headers["cookie"] = cookie;

      const runnerRes = await fetch(`${origin}/api/candidate/cv/parse/trigger`, {
        method: "POST",
        headers,
        body: JSON.stringify({ job_id: job.id }),
        cache: "no-store",
      });

      runnerStatus = runnerRes.status;
      runnerTriggered = runnerRes.ok;
      console.info("CV_PARSE_TRIGGER_REQUEST_RECEIVED", {
        jobId: job.id,
        uploadId: upload.id,
        origin,
      });

      if (!runnerRes.ok) {
        const txt = await runnerRes.text().catch(() => "");
        runnerError = txt.slice(0, 500) || `runner_failed_${runnerRes.status}`;
        await markCvParseJobFailed({
          admin,
          jobId: String(job.id),
          errorMessage: runnerError,
        });
      }
    } catch (e: any) {
      runnerError = String(e?.message || e);
      await markCvParseJobFailed({
        admin,
        jobId: String(job.id),
        errorMessage: runnerError,
      });
    }

    console.info("CV_PARSE_TRIGGER_DISPATCH_RESULT", {
      jobId: job.id,
      runnerTriggered,
      runnerStatus,
      runnerError,
    });
    console.info("CV_PARSE_ROUTE_TRIGGER_CALL_DONE", {
      jobId: job.id,
      runnerTriggered,
      runnerStatus,
      runnerError,
    });
    debugStage = "response";
    const responseBody = {
      ok: true,
      job_id: job.id,
      status: runnerTriggered ? job.status : "failed",
      created_at: job.created_at,
      upload_id: upload.id,
      runner_triggered: runnerTriggered,
      runner_status: runnerStatus,
      runner_error: runnerError,
      processing_dispatched: runnerTriggered,
      processing_error: runnerTriggered ? null : runnerError || "No pudimos iniciar el análisis automático.",
      fatal: false,
      debug_stage: debugStage,
    };
    if (runnerTriggered) {
      console.info("CV_PARSE_ROUTE_RESPONSE_OK", {
        jobId: job.id,
        uploadId: upload.id,
        status: responseBody.status,
      });
    } else {
      console.error("CV_PARSE_ROUTE_RESPONSE_PARTIAL", {
        jobId: job.id,
        uploadId: upload.id,
        status: responseBody.status,
        processingError: responseBody.processing_error,
      });
    }
    return NextResponse.json(responseBody);
  } catch (e: any) {
    const fatalMessage = String(e?.message || e);
    console.error("CV_PARSE_ROUTE_FATAL", {
      error: fatalMessage,
      createdJobId,
      createdUploadId,
      debugStage,
    });
    if (admin && createdJobId) {
      await markCvParseJobFailed({
        admin,
        jobId: createdJobId,
        errorMessage: fatalMessage,
      });
      console.error("CV_PARSE_ROUTE_TRIGGER_FAILED", {
        jobId: createdJobId,
        uploadId: createdUploadId,
        error: fatalMessage,
      });
      console.error("CV_PARSE_ROUTE_RESPONSE_PARTIAL", {
        jobId: createdJobId,
        uploadId: createdUploadId,
        status: "failed",
        processingError: fatalMessage,
      });
      return NextResponse.json({
        ok: true,
        job_id: createdJobId,
        upload_id: createdUploadId,
        status: "failed",
        created_at: null,
        runner_triggered: false,
        runner_status: null,
        runner_error: fatalMessage,
        processing_dispatched: false,
        processing_error: fatalMessage,
        fatal: false,
        debug_stage: debugStage,
      });
    }
    console.error("CV_PARSE_ROUTE_RESPONSE_FATAL", {
      error: fatalMessage,
      debugStage,
    });
    return NextResponse.json(
      {
        error: "bad_request",
        details: fatalMessage,
        fatal: true,
        debug_stage: debugStage,
      },
      { status: 400 }
    );
  }
}
