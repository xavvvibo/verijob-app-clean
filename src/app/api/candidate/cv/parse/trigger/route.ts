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

function getOpenAIKey(): string | null {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.OPEN_API_KEY ||
    process.env.OPENAI_KEY ||
    null
  );
}

function getInternalSecret(): string {
  return process.env.INTERNAL_ADMIN_SECRET || "";
}

function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getServiceKey();
  if (!url || !key) {
    throw new Error("missing_supabase_admin_env");
  }
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  let jobId: string | null = null;
  let supabase: ReturnType<typeof createSupabaseAdmin> | null = null;

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
    jobId = typeof payload?.job_id === "string" ? payload.job_id.trim() : null;
    if (!jobId) {
      return NextResponse.json({ error: "missing_job_id" }, { status: 400 });
    }

    supabase = createAdminClient();

    const { data: job, error: jobErr } = await supabase
      .from("cv_parse_jobs")
      .select("id,user_id,cv_upload_id")
      .eq("id", jobId)
      .single();

    if (jobErr) {
      return NextResponse.json({ error: "job_query_failed", details: jobErr.message }, { status: 400 });
    }

    if (!job) {
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }

    if (!isInternalCall && requesterUserId && job.user_id !== requesterUserId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await supabase
      .from("cv_parse_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", job.id);

    const { data: upload, error: uploadErr } = await supabase
      .from("cv_uploads")
      .select("*")
      .eq("id", job.cv_upload_id)
      .single();

    if (uploadErr || !upload) {
      throw new Error(`upload_not_found: ${uploadErr?.message || "missing_upload"}`);
    }

    const { data: file, error: downloadErr } = await supabase.storage
      .from(upload.storage_bucket)
      .download(upload.storage_path);

    if (downloadErr || !file) {
      throw new Error(`file_download_failed: ${downloadErr?.message || "missing_file"}`);
    }

    const openaiKey = getOpenAIKey();
    if (!openaiKey) {
      throw new Error("missing_openai_api_key");
    }

    const form = new FormData();
    form.append("file", file, upload.original_filename || "cv_upload");

    const uploadRes = await fetch(
      "https://api.openai.com/v1/files",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form
      }
    );

    if (!uploadRes.ok) {
      const txt = await uploadRes.text().catch(() => "");
      throw new Error(`openai_file_upload_failed_${uploadRes.status}: ${txt.slice(0, 300)}`);
    }

    const fileJson = await uploadRes.json();
    if (!fileJson?.id) {
      throw new Error("openai_file_id_missing");
    }

    const resp = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: "Extract work experiences from this CV." },
                { type: "input_file", file_id: fileJson.id }
              ]
            }
          ]
        })
      }
    );

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`openai_response_failed_${resp.status}: ${txt.slice(0, 300)}`);
    }

    const result = await resp.json();

    await supabase
      .from("cv_parse_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        error: null,
        result_json: result
      })
      .eq("id", job.id);

    return NextResponse.json({
      ok: true,
      job_id: job.id
    });

  } catch (e:any) {
    if (supabase && jobId) {
      await supabase
        .from("cv_parse_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: String(e?.message || e).slice(0, 1000),
        })
        .eq("id", jobId);
    }

    return NextResponse.json({
      error: "trigger_failed",
      details: String(e?.message || e)
    }, { status: 500 });

  }
}
