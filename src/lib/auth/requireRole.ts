import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

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

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  if (!allowed.includes(profile.role)) {
    redirect("/dashboard");
  }

  return {
    user: data.user,
    role: profile.role,
  };
}
