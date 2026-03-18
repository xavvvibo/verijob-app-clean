import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveAuthenticatedRouting } from "@/lib/auth/post-login-redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardRouter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active_company_id, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    redirect(resolveAuthenticatedRouting({ user, currentPath: "/dashboard" }).destination);
  }

  const routing = resolveAuthenticatedRouting({
    ...(profile || {}),
    user,
    currentPath: "/dashboard",
  });
  if (routing.shouldRedirect) redirect(routing.destination);
  redirect(routing.destination);
}
