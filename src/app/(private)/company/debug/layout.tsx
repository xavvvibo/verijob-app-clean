import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompanyDebugLayout({ children }: { children: React.ReactNode }) {
  if (process.env.ENABLE_INTERNAL_DEBUG !== "true") redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", au.user.id)
    .maybeSingle();

  if ((profile?.role || "").toLowerCase() !== "owner") redirect("/dashboard");
  return <>{children}</>;
}
