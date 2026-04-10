import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { resolveCandidateMinimumReadiness } from "@/lib/auth/onboarding-state";

export async function requireCandidateMinimumReadiness(
  next = "/candidate/overview",
  options?: { requireFullReadiness?: boolean }
) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const [{ data: profile }, { count: experienceCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,title")
      .eq("id", auth.user.id)
      .maybeSingle(),
    supabase
      .from("profile_experiences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id),
  ]);

  const readiness = resolveCandidateMinimumReadiness({
    full_name: (profile as any)?.full_name,
    title: (profile as any)?.title,
    experienceCount: Number(experienceCount || 0),
  });

  if (!readiness.hasFullName) {
    redirect("/onboarding?blocked=1&source=candidate&reason=missing_name");
  }

  if ((options?.requireFullReadiness ?? true) && !readiness.isReady) {
    redirect("/onboarding?blocked=1&source=candidate");
  }

  return {
    userId: auth.user.id,
    readiness,
  };
}
