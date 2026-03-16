import { NextResponse } from "next/server";
import { runPendingBackgroundJobs } from "@/lib/jobs/background-processing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  const expectedSecret = process.env.INTERNAL_ADMIN_SECRET || "";
  const suppliedSecret = req.headers.get("x-internal-secret") || "";

  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return unauthorized();
  }

  try {
    const body = await req.json().catch(() => ({}));
    const jobType = String(body?.job_type || "all").trim() as
      | "candidate_cv"
      | "company_candidate_import"
      | "evidence_processing"
      | "all";
    const jobId = typeof body?.job_id === "string" ? body.job_id.trim() : null;
    const limit = Number(body?.limit || 3);

    const results = await runPendingBackgroundJobs({
      jobType,
      jobId,
      limit,
    });

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "jobs_process_failed",
        details: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
