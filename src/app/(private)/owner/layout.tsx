import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { isOwnerSessionRole, resolveSessionRole } from "@/lib/auth/session-role";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login?next=/owner/overview");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", au.user.id)
    .maybeSingle();

  const role = resolveSessionRole({ profileRole: profile?.role, user: au.user });
  if (!isOwnerSessionRole(role)) {
    if (role === "candidate") redirect("/candidate/overview?forbidden=1&from=owner");
    if (role === "company") redirect("/company?forbidden=1&from=owner");
    redirect("/dashboard?forbidden=1&from=owner");
  }

  return <>{children}</>;
}
