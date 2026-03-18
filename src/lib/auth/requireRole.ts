import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { resolveAuthenticatedHomePath } from "@/lib/auth/post-login-redirect";

export async function requireRole(
  allowed: ("candidate" | "company" | "owner")[]
) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,onboarding_completed")
    .eq("id", data.user.id)
    .single();

  if (String(profile?.role || "").toLowerCase() === "candidate" && !profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  if (!allowed.includes(profile.role)) {
    redirect(resolveAuthenticatedHomePath(profile || {}));
  }

  return {
    user: data.user,
    role: profile.role,
  };
}
