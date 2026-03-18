import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { resolveCandidateOnboardingCompleted } from "@/lib/auth/onboarding-state";
import { resolveAuthenticatedHomePath } from "@/lib/auth/post-login-redirect";
import { resolveSessionRole } from "@/lib/auth/session-role";

export async function requireRole(
  allowed: ("candidate" | "company" | "owner")[]
) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,app_role,onboarding_completed")
    .eq("id", data.user.id)
    .single();

  const role = resolveSessionRole({
    profileRole: profile?.role,
    profileAppRole: (profile as any)?.app_role,
    user: data.user,
  });

  if (role === "candidate" && !resolveCandidateOnboardingCompleted(profile || {})) {
    redirect("/onboarding");
  }

  if (!allowed.includes(role as any)) {
    const destination = resolveAuthenticatedHomePath({ ...(profile || {}), user: data.user });
    if (destination) redirect(destination);
  }

  return {
    user: data.user,
    role,
  };
}
