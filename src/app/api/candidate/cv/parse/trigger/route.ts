import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.job_id === "string" ? body.job_id : null;

    if (!jobId) {
      return NextResponse.json({ error: "missing_job_id" }, { status: 400 });
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceKey();
    const internalSecret = getInternalSecret();

    if (!supabaseUrl || !serviceKey || !internalSecret) {
      return NextResponse.json(
        {
          error: "missing_server_env",
          has_url: !!supabaseUrl,
          has_service_key: !!serviceKey,
          has_internal_secret: !!internalSecret,
        },
        { status: 500 }
      );
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: job, error: jobErr } = await admin
      .from("cv_parse_jobs")
      .select("id,user_id,status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr) {
      return NextResponse.json({ error: "job_query_failed", details: jobErr.message }, { status: 400 });
    }

    if (!job) {
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }

    if (job.user_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const origin = new URL(req.url).origin;

    const runnerRes = await fetch(`${origin}/api/internal/cv-parse/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({ job_id: jobId }),
      cache: "no-store",
    });

    const text = await runnerRes.text().catch(() => "");

    return new NextResponse(text || "{}", {
      status: runnerRes.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "trigger_failed", details: String(e?.message || e) },
      { status: 400 }
    );
  }
}
