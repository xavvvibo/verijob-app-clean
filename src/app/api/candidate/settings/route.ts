import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("show_trust_score,show_verification_counts,show_verified_timeline")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "read_failed", details: error.message }, { status: 400 });

  return NextResponse.json({
    settings: data || {
      show_trust_score: true,
      show_verification_counts: true,
      show_verified_timeline: true,
    }
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch = {
    show_trust_score: typeof body.show_trust_score === "boolean" ? body.show_trust_score : undefined,
    show_verification_counts: typeof body.show_verification_counts === "boolean" ? body.show_verification_counts : undefined,
    show_verified_timeline: typeof body.show_verified_timeline === "boolean" ? body.show_verified_timeline : undefined,
    updated_at: new Date().toISOString(),
  } as any;

  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const { error } = await supabase
    .from("candidate_profiles")
    .update(patch)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "update_failed", details: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
