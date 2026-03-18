import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveAuthenticatedRouting } from "@/lib/auth/post-login-redirect";

export default async function AppRootPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,app_role,onboarding_completed")
    .eq("id", auth.user.id)
    .maybeSingle();

  redirect(resolveAuthenticatedRouting({ ...(profile || {}), user: auth.user }).destination);
}
