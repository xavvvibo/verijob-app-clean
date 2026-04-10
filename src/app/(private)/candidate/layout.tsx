import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { resolveCandidateOnboardingCompleted } from "@/lib/auth/onboarding-state";

export const metadata: Metadata = {
  title: { default: "VERIJOB — Candidato", template: "VERIJOB Candidato — %s" },
  description: "Dashboard del candidato: verificaciones, evidencias y CV.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const cookieStore = await cookies();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login?next=/candidate/overview");

  const [{ data: profile }, { count: experienceCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role,active_company_id,onboarding_completed,onboarding_step,full_name,title")
      .eq("id", au.user.id)
      .maybeSingle(),
    supabase
      .from("profile_experiences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", au.user.id),
  ]);

  const role = String(profile?.role || "").toLowerCase();

  if (!role) redirect("/login?next=/candidate/overview");
  if (role === "company") redirect("/company?forbidden=1&from=candidate");
  if (role === "owner") redirect("/owner?forbidden=1&from=candidate");

  const onboardingAccessGranted = cookieStore.get("candidate_onboarding_access")?.value === "1";
  const onboardingCompleted = resolveCandidateOnboardingCompleted({
    ...(profile || {}),
    experienceCount: Number(experienceCount || 0),
  });

  if (!onboardingCompleted && !onboardingAccessGranted) {
    redirect("/onboarding?blocked=1&source=candidate");
  }

  return <>{children}</>;
}
