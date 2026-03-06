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

export async function POST(req: Request) {
  try {
    const auth = await createRouteHandlerClient();
    const { data: { user } } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { job_id } = await req.json();

    const supabase = createSupabaseAdmin(
      getSupabaseUrl(),
      getServiceKey() as string,
      { auth: { persistSession: false } }
    );

    const { data: job } = await supabase
      .from("cv_parse_jobs")
      .select("id,user_id,cv_upload_id")
      .eq("id", job_id)
      .single();

    if (!job) {
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }

    await supabase
      .from("cv_parse_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString()
      })
      .eq("id", job.id);

    const { data: upload } = await supabase
      .from("cv_uploads")
      .select("*")
      .eq("id", job.cv_upload_id)
      .single();

    const { data: file } = await supabase
      .storage
      .from(upload.storage_bucket)
      .download(upload.storage_path);

    const openaiKey = getOpenAIKey();

    const form = new FormData();
    form.append("file", file as any);

    const uploadRes = await fetch(
      "https://api.openai.com/v1/files",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form
      }
    );

    const fileJson = await uploadRes.json();

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

    const result = await resp.json();

    await supabase
      .from("cv_parse_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        result_json: result
      })
      .eq("id", job.id);

    return NextResponse.json({
      ok: true,
      job_id: job.id
    });

  } catch (e:any) {

    return NextResponse.json({
      error: "trigger_failed",
      details: String(e?.message || e)
    }, { status: 500 });

  }
}
