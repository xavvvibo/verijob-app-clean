import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveAuthenticatedHomePath } from "@/lib/auth/post-login-redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardRouter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single();

  redirect(resolveAuthenticatedHomePath(profile || {}));
}
