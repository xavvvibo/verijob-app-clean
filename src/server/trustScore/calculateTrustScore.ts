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

function isMissingTrustRpcSignature(error: any) {
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  return (
    String(error?.code || "") === "PGRST202" &&
    (message.includes("calculate_candidate_trust_from_employment") ||
      details.includes("calculate_candidate_trust_from_employment"))
  );
}

export async function calculateTrustScore(candidateId: string): Promise<TrustResult> {
  const admin = createAdminSupabaseClient();
  return readCandidateTrustProfile(admin, candidateId);
}

export async function recalculateAndPersistCandidateTrustScore(candidateId: string): Promise<TrustResult> {
  const admin = createAdminSupabaseClient();

  let rpcResult = await admin.rpc("calculate_candidate_trust_from_employment", {
    user_id: candidateId,
  });

  if (rpcResult.error && isMissingTrustRpcSignature(rpcResult.error)) {
    rpcResult = await admin.rpc("calculate_candidate_trust_from_employment", {
      p_user_id: candidateId,
    });
  }

  if (rpcResult.error) throw rpcResult.error;

  let trust = await readCandidateTrustProfile(admin, candidateId);
  const rpcScore = Number(rpcResult.data ?? 0);

  if (trust.score <= 0 && Number.isFinite(rpcScore) && rpcScore > 0) {
    const patchedBreakdown = {
      ...(trust.breakdown || {}),
      updated_at: new Date().toISOString(),
      model: (trust.breakdown as any)?.model || "trust_model_v3_rpc_fallback",
    };

    const updateRes = await admin
      .from("candidate_profiles")
      .update({
        trust_score: rpcScore,
        trust_score_breakdown: patchedBreakdown,
      })
      .eq("user_id", candidateId)
      .select("trust_score,trust_score_breakdown")
      .maybeSingle();

    if (!updateRes.error) {
      trust = {
        score: Number((updateRes.data as any)?.trust_score ?? rpcScore),
        breakdown: {
          ...(patchedBreakdown || {}),
          ...asObject((updateRes.data as any)?.trust_score_breakdown),
        },
      };
    }
  }

  return trust;
}
