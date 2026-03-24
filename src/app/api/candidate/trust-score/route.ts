import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";
import { normalizeTrustBreakdown } from "@/lib/trust/trust-model";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("candidate_profiles")
      .select("trust_score,trust_score_breakdown")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    const normalized = normalizeTrustBreakdown((data as any)?.trust_score_breakdown);
    return NextResponse.json({
      route_version: "candidate-trust-score-v3-canonical-read",
      trust_score: Number((data as any)?.trust_score ?? 0),
      breakdown: {
        ...((data as any)?.trust_score_breakdown || {}),
        ...normalized.display,
      },
      source_of_truth: "candidate_profiles.trust_score",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "trust_score_failed", details: String(error?.message || error) },
      { status: 400 }
    );
  }
}

export async function POST() {
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
      route_version: "candidate-trust-score-v3-rpc-refresh",
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
