import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";
import { normalizeTrustBreakdown } from "@/lib/trust/trust-model";

function isVerifiedEmploymentStatus(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  return status === "verified" || status === "approved" || status === "verified_document" || status === "verified_paid";
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [{ data, error }, { data: employmentRows, error: employmentError }] = await Promise.all([
      supabase
        .from("candidate_profiles")
        .select("trust_score,trust_score_breakdown")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("employment_records").select("verification_status").eq("candidate_id", user.id),
    ]);
    if (error) throw error;
    if (employmentError) throw employmentError;

    const storedTrustScore = Number((data as any)?.trust_score ?? 0);
    const hasVerifiedEmployment = Array.isArray(employmentRows)
      ? employmentRows.some((row: any) => isVerifiedEmploymentStatus(row?.verification_status))
      : false;

    if (storedTrustScore <= 0 && hasVerifiedEmployment) {
      const result = await recalculateAndPersistCandidateTrustScore(user.id);
      return NextResponse.json({
        route_version: "candidate-trust-score-v3-canonical-read-auto-refreshed",
        trust_score: result.score,
        breakdown: result.breakdown,
        source_of_truth: "candidate_profiles.trust_score",
      });
    }

    const normalized = normalizeTrustBreakdown((data as any)?.trust_score_breakdown);
    return NextResponse.json({
      route_version: "candidate-trust-score-v3-canonical-read",
      trust_score: storedTrustScore,
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
