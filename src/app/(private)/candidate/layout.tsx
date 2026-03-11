import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: { default: "VERIJOB — Candidato", template: "VERIJOB Candidato — %s" },
  description: "Dashboard del candidato: verificaciones, evidencias y CV.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login?next=/candidate/overview");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,onboarding_completed")
    .eq("id", au.user.id)
    .maybeSingle();

  const role = String(profile?.role || "").toLowerCase();
  if (role !== "candidate") redirect("/dashboard");

  if (!profile?.onboarding_completed) redirect("/onboarding?blocked=1&source=candidate");

  return <>{children}</>;
}
