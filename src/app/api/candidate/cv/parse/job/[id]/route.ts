import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabaseClient();

  const { data: job, error } = await admin
    .from("cv_parse_jobs")
    .select("id,user_id,status,error,model,tokens_in,tokens_out,result_json,created_at,started_at,finished_at")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!job || job.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ job }, { status: 200 });
}
