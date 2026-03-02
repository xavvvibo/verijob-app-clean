import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, onboarding_completed")
    .eq("id", au.user.id)
    .maybeSingle();

  // Si no hay profile, lo tratamos como onboarding (flujo seguro)
  if (!profile) redirect("/onboarding");

  // Si no ha completado onboarding, forzamos onboarding
  if (!profile.onboarding_completed) redirect("/onboarding");

  // Redirección por rol
  const role = (profile.role || "").toLowerCase();

  if (role === "candidate") redirect("/candidate");
  if (role === "company") redirect("/company/dashboard");
  if (role === "owner") redirect("/owner");

  // Si role viene raro/null, fallback seguro
  redirect("/candidate");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return <>{children}</>;
}
