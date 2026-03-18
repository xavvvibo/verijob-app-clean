import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveAuthenticatedHomePath } from "@/lib/auth/post-login-redirect";

export default async function AppRootPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,onboarding_completed")
    .eq("id", auth.user.id)
    .maybeSingle();

  const destination = resolveAuthenticatedHomePath({ ...(profile || {}), user: auth.user });
  if (destination) redirect(destination);

  redirect("/login");
}
