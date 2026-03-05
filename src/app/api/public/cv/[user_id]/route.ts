import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request, ctx: any) {

  const supabase = await createClient();

  const { user_id } = ctx.params || {};

  if (!user_id) {
    return NextResponse.json(
      { error: "missing_user_id" },
      { status: 400 }
    );
  }

  const { data: trust, error: trustError } = await supabase
    .from("candidate_cv_trust_scores")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();

  if (trustError) {
    return NextResponse.json(
      { error: "trust_score_query_failed", details: trustError.message },
      { status: 400 }
    );
  }

  const { data: experiences, error: expError } = await supabase
    .from("candidate_experience_scores")
    .select(`
      experience_id,
      status_text,
      score,
      evidence_count,
      reuse_count
    `)
    .eq("user_id", user_id);

  if (expError) {
    return NextResponse.json(
      { error: "experiences_query_failed", details: expError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    route_version: "public-cv-v2",
    candidate_id: user_id,
    trust_score: trust?.cv_trust_score ?? 0,
    experiences_total: trust?.experiences_total ?? 0,
    verified_experiences: trust?.verified_experiences ?? 0,
    evidences_total: trust?.evidences_total ?? 0,
    reuse_total: trust?.reuse_total ?? 0,
    experiences: experiences ?? []
  });
}
