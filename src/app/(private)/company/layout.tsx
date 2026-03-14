import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

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

  const role = String(profile?.role || "").toLowerCase();
  if (role !== "company") {
    if (role === "candidate") redirect("/candidate/overview?forbidden=1&from=company");
    if (role === "owner" || role === "admin") redirect("/owner/overview?forbidden=1&from=company");
    redirect("/dashboard?forbidden=1&from=company");
  }

  if (!profile?.onboarding_completed) redirect("/onboarding/company?blocked=1&source=company");

  if (!profile?.active_company_id) redirect("/company/candidates");

  return <>{children}</>;
}
