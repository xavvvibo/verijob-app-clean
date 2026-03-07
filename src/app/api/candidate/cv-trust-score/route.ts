import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const userId = userData.user.id;

  // Legacy compatibility route.
  // Canonical trust source is candidate_profiles.trust_score.
  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("trust_score,trust_score_breakdown")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "query_failed", details: error.message }, { status: 400 });
  }

  const breakdown = (data as any)?.trust_score_breakdown || {};
  const components = breakdown?.components || {};

  return NextResponse.json({
    route_version: "cv-trust-score-v1-compat-canonical",
    trust_score: Number((data as any)?.trust_score ?? 0),
    experiences_total: Number(breakdown?.total ?? 0),
    verified_experiences: Number(breakdown?.approved ?? 0),
    evidences_total: Number(breakdown?.evidences ?? 0),
    reuse_total: Number(breakdown?.reuseEvents ?? 0),
    source_of_truth: "candidate_profiles.trust_score",
    deprecated_legacy_table: "candidate_cv_trust_scores",
    components
  });
}
