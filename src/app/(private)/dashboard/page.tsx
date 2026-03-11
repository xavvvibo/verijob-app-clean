import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

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

  const r = String(profile?.role || "").toLowerCase();
  if (r === "owner" || r === "admin") redirect("/owner/overview");
  if (!profile?.onboarding_completed) redirect("/onboarding");
  if (r === "company") redirect("/company");
  redirect("/candidate/overview");
}
