import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await recalculateAndPersistCandidateTrustScore(user.id);
    return NextResponse.json({
      route_version: "candidate-trust-score-f28-single-source",
      trust_score: result.score,
      breakdown: result.breakdown,
      source_of_truth: "candidate_profiles.trust_score",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "trust_score_failed", details: String(error?.message || error) },
      { status: 400 }
    );
  }
}
