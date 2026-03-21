import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { resolveAuthenticatedRouting } from "@/lib/auth/post-login-redirect";

export const metadata: Metadata = {
  title: { default: "VERIJOB — Candidato", template: "VERIJOB Candidato — %s" },
  description: "Dashboard del candidato: verificaciones, evidencias y CV.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ONBOARDING_ALLOWED_CANDIDATE_PATHS = [
  "/candidate/experience",
  "/candidate/education",
  "/candidate/achievements",
  "/candidate/evidence",
  "/candidate/import-updates",
];

function resolveCurrentPathFromHeaders(h: Headers) {
  const candidates = [
    h.get("next-url"),
    h.get("x-invoke-path"),
    h.get("x-matched-path"),
    h.get("x-pathname"),
  ].filter(Boolean) as string[];

  for (const value of candidates) {
    try {
      if (value.startsWith("/")) return new URL(value, "https://app.verijob.es").pathname;
      return new URL(value).pathname;
    } catch {
      continue;
    }
  }

  return "";
}

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login?next=/candidate/overview");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,active_company_id,onboarding_completed")
    .eq("id", au.user.id)
    .maybeSingle();

  const currentPath = resolveCurrentPathFromHeaders(await headers());
  const routing = resolveAuthenticatedRouting({ ...(profile || {}), user: au.user, currentPath });
  if (routing.destination === "/onboarding") {
    if (ONBOARDING_ALLOWED_CANDIDATE_PATHS.some((path) => currentPath === path || currentPath.startsWith(`${path}/`))) {
      return <>{children}</>;
    }
    redirect("/onboarding?blocked=1&source=candidate");
  }

  if (routing.destination !== "/candidate/overview") {
    redirect(`${routing.destination}?forbidden=1&from=candidate`);
  }

  return <>{children}</>;
}
