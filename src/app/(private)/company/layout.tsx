import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

type Props = { children: React.ReactNode };

export const dynamic = "force-dynamic";

export default async function CompanyLayout({ children }: Props) {
  const supabase = await createServerSupabaseClient();

  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, active_company_id")
    .eq("id", au.user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  // IMPORTANTE: nunca redirigir a /dashboard desde /company
  if (!profile?.active_company_id) redirect("/company/reuse");

  return <>{children}</>;
}
