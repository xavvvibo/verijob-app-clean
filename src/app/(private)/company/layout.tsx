import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { resolveAuthenticatedRouting } from "@/lib/auth/post-login-redirect";

export const metadata: Metadata = {
  title: { default: "VERIJOB — Empresa", template: "VERIJOB Empresa — %s" },
  description: "Dashboard de empresa: verificación, cola y acceso temporal a perfiles.",
};

type Props = { children: React.ReactNode };

export const dynamic = "force-dynamic";

export default async function CompanyLayout({ children }: Props) {
  const supabase = await createServerSupabaseClient();

  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,onboarding_completed, active_company_id")
    .eq("id", au.user.id)
    .maybeSingle();

  const routing = resolveAuthenticatedRouting({ ...(profile || {}), user: au.user });
  if (routing.role !== "company") {
    redirect(`${routing.destination}?forbidden=1&from=company`);
  }

  if (!profile?.onboarding_completed) redirect("/onboarding/company?blocked=1&source=company");

  if (!profile?.active_company_id) redirect("/onboarding/company?blocked=1&source=company_context");

  return <>{children}</>;
}
