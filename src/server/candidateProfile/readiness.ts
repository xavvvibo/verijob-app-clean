export type CandidateProfileReadiness = {
  isReady: boolean;
  reason:
    | "ready"
    | "missing_profile_basics"
    | "missing_experience"
    | "verification_pending"
    | "no_verified_experience";
  verifiedExperiencesCount: number;
  totalExperiencesCount: number;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (query: string, options?: Record<string, unknown>) => any;
    eq: (column: string, value: string) => any;
    maybeSingle: () => Promise<{ data: any; error: any }>;
  };
};

function hasProfileBasics(profile: any): boolean {
  if (!profile) return false;
  const name =
    String(profile.full_name ?? profile.name ?? "").trim().length > 0;
  const headline =
    String(profile.headline ?? profile.title ?? profile.current_role ?? "").trim().length > 0;
  return name || headline;
}

export async function getCandidateProfileReadiness(
  supabase: SupabaseLike,
  candidateUserId: string
): Promise<CandidateProfileReadiness> {
  const profileRes = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", candidateUserId)
    .maybeSingle();

  if (profileRes.error) {
    throw profileRes.error;
  }

  const experiencesRes = await supabase
    .from("employment_records")
    .select("id, verification_status")
    .eq("candidate_id", candidateUserId);

  if (experiencesRes.error) {
    throw experiencesRes.error;
  }

  const profile = profileRes.data ?? null;
  const experiences = Array.isArray(experiencesRes.data) ? experiencesRes.data : [];
  const totalExperiencesCount = experiences.length;
  const verifiedExperiencesCount = experiences.filter(
    (item: any) => String(item?.verification_status ?? "") === "verified"
  ).length;

  if (!profile) {
    return {
      isReady: false,
      reason: "missing_profile_basics",
      verifiedExperiencesCount,
      totalExperiencesCount,
    };
  }

  if (totalExperiencesCount === 0) {
    return {
      isReady: false,
      reason: "missing_experience",
      verifiedExperiencesCount,
      totalExperiencesCount,
    };
  }

  if (verifiedExperiencesCount === 0) {
    return {
      isReady: false,
      reason: hasProfileBasics(profile) ? "verification_pending" : "missing_profile_basics",
      verifiedExperiencesCount,
      totalExperiencesCount,
    };
  }

  return {
    isReady: true,
    reason: "ready",
    verifiedExperiencesCount,
    totalExperiencesCount,
  };
}
