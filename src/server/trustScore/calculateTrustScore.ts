import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import { normalizeTrustBreakdown } from "@/lib/trust/trust-model";

export type TrustBreakdown = Record<string, any>;

export type TrustResult = {
  score: number;
  breakdown: TrustBreakdown;
};

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

async function readCandidateTrustProfile(admin: any, candidateId: string): Promise<TrustResult> {
  const { data, error } = await admin
    .from("candidate_profiles")
    .select("trust_score,trust_score_breakdown")
    .eq("user_id", candidateId)
    .maybeSingle();

  if (error) throw error;

  const score = Number((data as any)?.trust_score ?? 0);
  const rawBreakdown = asObject((data as any)?.trust_score_breakdown);
  const normalized = normalizeTrustBreakdown(rawBreakdown);

  return {
    score: Number.isFinite(score) ? score : 0,
    breakdown: {
      ...rawBreakdown,
      verification: normalized.legacy.verification,
      evidence: normalized.legacy.evidence,
      consistency: normalized.legacy.consistency,
      reuse: normalized.legacy.reuse,
      approved: rawBreakdown.approved ?? normalized.legacy.approved,
      confirmed: rawBreakdown.confirmed ?? normalized.legacy.confirmed,
      evidences: rawBreakdown.evidences ?? normalized.legacy.evidences,
      reuseEvents: rawBreakdown.reuseEvents ?? normalized.legacy.reuseEvents,
      reuseCompanies: rawBreakdown.reuseCompanies ?? normalized.legacy.reuseCompanies,
      model: rawBreakdown.model ?? normalized.meta.model ?? "trust_model_v3",
      updated_at: rawBreakdown.updated_at ?? normalized.meta.updated_at,
      experience_total: rawBreakdown.experience_total ?? normalized.meta.experience_total,
      weights: rawBreakdown.weights ?? normalized.meta.weights,
    },
  };
}

export async function calculateTrustScore(candidateId: string): Promise<TrustResult> {
  const admin = createAdminSupabaseClient();
  return readCandidateTrustProfile(admin, candidateId);
}

export async function recalculateAndPersistCandidateTrustScore(candidateId: string): Promise<TrustResult> {
  const admin = createAdminSupabaseClient();

  const { error } = await admin.rpc("calculate_candidate_trust_from_employment", {
    user_id: candidateId,
  });
  if (error) throw error;

  return readCandidateTrustProfile(admin, candidateId);
}
