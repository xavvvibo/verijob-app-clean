import { NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createServerClient();

  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const userId = userData.user.id;

  const { data, error } = await supabase
    .from("candidate_cv_trust_scores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 400 });
  }

  return NextResponse.json({
    route_version: "cv-trust-score-v1",
    trust_score: data?.cv_trust_score ?? 0,
    experiences_total: data?.experiences_total ?? 0,
    verified_experiences: data?.verified_experiences ?? 0,
    evidences_total: data?.evidences_total ?? 0,
    reuse_total: data?.reuse_total ?? 0
  });
}
