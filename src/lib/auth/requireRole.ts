import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { resolveAuthenticatedRouting, roleMatchesAllowed } from "@/lib/auth/post-login-redirect";

export async function requireRole(
  allowed: ("candidate" | "company" | "owner")[]
) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,app_role,active_company_id,onboarding_completed")
    .eq("id", data.user.id)
    .single();

  const routing = resolveAuthenticatedRouting({ ...(profile || {}), user: data.user });
  const role = routing.role;

  if (role === "candidate" && !routing.onboardingCompleted) {
    redirect("/onboarding");
  }

  if (!roleMatchesAllowed(role, allowed)) {
    redirect(routing.destination);
  }

  return {
    user: data.user,
    role,
  };
}
