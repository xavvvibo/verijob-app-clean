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
    .select("role,active_company_id,onboarding_completed,onboarding_step")
    .eq("id", auth.user.id)
    .maybeSingle();

  redirect(resolveAuthenticatedRouting({ ...(profile || {}), user: auth.user }).destination);
}
