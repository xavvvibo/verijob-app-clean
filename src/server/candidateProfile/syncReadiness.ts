import { getCandidateProfileReadiness } from "@/server/candidateProfile/readiness";

type SupabaseLike = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => any;
    eq: (column: string, value: string) => any;
  };
};

export async function syncCandidateProfileReadiness(
  supabase: any,
  candidateUserId: string
) {
  const readiness = await getCandidateProfileReadiness(supabase, candidateUserId);

  const updateRes = await supabase
    .from("candidate_profiles")
    .update({
      profile_ready_for_company_access: readiness.isReady,
      profile_ready_reason: readiness.reason,
      profile_ready_updated_at: new Date().toISOString(),
    })
    .eq("user_id", candidateUserId);

  if (updateRes.error) {
    throw updateRes.error;
  }

  return readiness;
}
