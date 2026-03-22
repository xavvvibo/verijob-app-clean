import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { dispatchBackgroundJob } from "@/lib/jobs/background-processing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getInternalSecret(): string {
  return process.env.INTERNAL_ADMIN_SECRET || "";
}

async function markCvParseJobFailed(params: {
  supabase: any;
  jobId: string;
  errorMessage: string;
}) {
  const failedAt = new Date().toISOString();
  await params.supabase
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
}

export async function POST(req: Request) {
  try {
    const internalSecret = getInternalSecret();
    const suppliedSecret = req.headers.get("x-internal-secret") || "";
    const isInternalCall = !!internalSecret && suppliedSecret === internalSecret;
    let requesterUserId: string | null = null;

    if (!isInternalCall) {
      const auth = await createRouteHandlerClient();
      const {
        data: { user },
      } = await auth.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      requesterUserId = user.id;
    }

    const payload = await req.json().catch(() => null);
    const jobId = typeof payload?.job_id === "string" ? payload.job_id.trim() : "";
    if (!jobId) {
      return NextResponse.json({ error: "missing_job_id" }, { status: 400 });
    }
    console.info("CV_PARSE_DISPATCH_START", { jobId, isInternalCall, requesterUserId });
    console.info("CV_PARSE_TRIGGER_REQUEST_RECEIVED", { jobId, isInternalCall, requesterUserId });

    const supabase = createServiceRoleClient() as any;
    const { data: job, error: jobErr } = await supabase
      .from("cv_parse_jobs")
      .select("id,user_id,status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr) {
      console.error("CV_PARSE_DISPATCH_JOB_QUERY_FAILED", { jobId, error: jobErr.message });
      return NextResponse.json({ error: "job_query_failed", details: jobErr.message }, { status: 400 });
    }
    if (!job?.id) {
      console.error("CV_PARSE_DISPATCH_JOB_NOT_FOUND", { jobId });
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }
    console.info("CV_PARSE_TRIGGER_JOB_LOOKUP_OK", {
      jobId,
      userId: job.user_id,
      currentStatus: job.status,
    });
    if (!isInternalCall && requesterUserId && requesterUserId !== String(job.user_id || "")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const nextStatus = ["succeeded", "processing"].includes(String(job.status || "").toLowerCase())
      ? String(job.status || "queued").toLowerCase()
      : "queued";

    if (nextStatus === "queued") {
      await supabase
        .from("cv_parse_jobs")
        .update({
          status: "queued",
          error: null,
          started_at: null,
          finished_at: null,
        })
        .eq("id", jobId);
    }

    const origin = new URL(req.url).origin;
    let dispatchResult: Awaited<ReturnType<typeof dispatchBackgroundJob>>;
    try {
      dispatchResult = await dispatchBackgroundJob({
        origin,
        jobType: "candidate_cv",
        jobId,
      });
      if (dispatchResult.ok) {
        console.info("CV_PARSE_DISPATCH_OK", {
          jobId,
          mode: dispatchResult.mode,
          status: dispatchResult.status,
          details: dispatchResult.details || null,
        });
      } else {
        console.error("CV_PARSE_DISPATCH_FAILED", {
          jobId,
          mode: dispatchResult.mode,
          status: dispatchResult.status,
          details: dispatchResult.details || null,
          error: dispatchResult.error || null,
        });
        await markCvParseJobFailed({
          supabase,
          jobId,
          errorMessage: dispatchResult.error || dispatchResult.details || "cv_parse_dispatch_failed",
        });
        console.error("CV_PARSE_TRIGGER_JOB_MARKED_FAILED", {
          jobId,
          error: dispatchResult.error || dispatchResult.details || "cv_parse_dispatch_failed",
        });
      }
    } catch (error: any) {
      const dispatchMessage = String(error?.message || error || "cv_parse_dispatch_failed");
      console.error("CV_PARSE_DISPATCH_FAILED", {
        jobId,
        mode: "exception",
        status: 500,
        error: dispatchMessage,
      });
      await markCvParseJobFailed({
        supabase,
        jobId,
        errorMessage: dispatchMessage,
      });
      console.error("CV_PARSE_TRIGGER_JOB_MARKED_FAILED", {
        jobId,
        error: dispatchMessage,
      });
      dispatchResult = {
        ok: false,
        mode: "inline",
        status: 500,
        details: "dispatch_exception",
        error: dispatchMessage,
      };
    }

    const responseBody = {
      ok: true,
      accepted: true,
      job_id: jobId,
      status: dispatchResult.ok ? nextStatus : "failed",
      processing_dispatched: dispatchResult.ok,
      processing_error: dispatchResult.ok ? null : dispatchResult.error || dispatchResult.details || "cv_parse_dispatch_failed",
      dispatch: dispatchResult,
    };
    console.info("CV_PARSE_TRIGGER_DISPATCH_RESULT", {
      jobId,
      processingDispatched: responseBody.processing_dispatched,
      processingError: responseBody.processing_error,
      dispatchMode: dispatchResult.mode,
      dispatchStatus: dispatchResult.status,
    });
    console.info("CV_PARSE_TRIGGER_RESPONSE_OK", {
      jobId,
      status: responseBody.status,
      processingDispatched: responseBody.processing_dispatched,
    });
    return NextResponse.json(responseBody, { status: 202 });
  } catch (error: any) {
    console.error("CV_PARSE_TRIGGER_FATAL", {
      error: String(error?.message || error),
    });
    return NextResponse.json(
      {
        error: "trigger_failed",
        details: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
