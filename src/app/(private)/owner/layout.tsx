import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { resolveAuthenticatedRouting } from "@/lib/auth/post-login-redirect";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login?next=/owner/overview");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,app_role")
    .eq("id", au.user.id)
    .maybeSingle();

  const routing = resolveAuthenticatedRouting({ ...(profile || {}), user: au.user });
  if (routing.role !== "owner" && routing.role !== "admin") {
    redirect(`${routing.destination}?forbidden=1&from=owner`);
  }

  return <>{children}</>;
}
