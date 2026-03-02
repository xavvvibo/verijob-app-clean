import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", au.user.id)
    .maybeSingle();

  const role = (profile?.role || "").toLowerCase();

  if (role !== "company" && role !== "owner") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
