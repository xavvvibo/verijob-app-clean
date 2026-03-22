import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveAuthenticatedRouting } from "@/lib/auth/post-login-redirect";
import { resolveCandidateOnboardingCompleted } from "@/lib/auth/onboarding-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardRouter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active_company_id, onboarding_completed, onboarding_step")
    .eq("id", user.id)
    .maybeSingle();

  const role = String(profile?.role || "").toLowerCase();

  const candidateOnboardingCompleted = resolveCandidateOnboardingCompleted(profile || {});

  if (role === "candidate" && candidateOnboardingCompleted) {
    redirect("/candidate/overview");
  }

  if (role === "candidate" && !candidateOnboardingCompleted) {
    redirect("/onboarding");
  }

  const routing = resolveAuthenticatedRouting({
    ...(profile || {}),
    user,
    currentPath: "/dashboard",
  });

  redirect(routing.destination);
}
