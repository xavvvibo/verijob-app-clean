import { after, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { dispatchBackgroundJob } from "@/lib/jobs/background-processing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getInternalSecret(): string {
  return process.env.INTERNAL_ADMIN_SECRET || "";
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

    const supabase = createServiceRoleClient() as any;
    const { data: job, error: jobErr } = await supabase
      .from("cv_parse_jobs")
      .select("id,user_id,status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr) {
      return NextResponse.json({ error: "job_query_failed", details: jobErr.message }, { status: 400 });
    }
    if (!job?.id) {
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }
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
    after(async () => {
      try {
        await dispatchBackgroundJob({
          origin,
          jobType: "candidate_cv",
          jobId,
        });
      } catch {
        // The queued job remains available for retry or manual runner execution.
      }
    });

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        job_id: jobId,
        status: nextStatus,
      },
      { status: 202 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "trigger_failed",
        details: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
