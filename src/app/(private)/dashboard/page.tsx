import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardEntry() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  const role = profile?.role ?? "candidate";

  // Ajusta si tu enum de role usa otros valores.
  if (role === "company" || role === "admin" || role === "recruiter" || role === "reviewer") {
    redirect("/company/dashboard");
  }

  redirect("/candidate/overview");
}
