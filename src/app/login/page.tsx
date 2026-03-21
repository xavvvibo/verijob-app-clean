import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";
import { createClient } from "@/utils/supabase/server";
import { resolveAuthenticatedRouting } from "@/lib/auth/post-login-redirect";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props?.searchParams) || {};
  const forceParam = Array.isArray(searchParams?.force) ? searchParams.force[0] : searchParams?.force;
  const logoutParam = Array.isArray(searchParams?.logout) ? searchParams.logout[0] : searchParams?.logout;
  const allowLoginScreen = String(forceParam || "") === "1" || String(logoutParam || "") === "1";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth?.user && !allowLoginScreen) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,active_company_id,onboarding_completed")
      .eq("id", auth.user.id)
      .maybeSingle();
    redirect(resolveAuthenticatedRouting({ ...(profile || {}), user: auth.user }).destination);
  }

  return (
    <PublicAuthShell
      title="Acceso seguro a tu entorno VERIJOB"
      subtitle="Entra por código de un solo uso para gestionar verificaciones, evidencias y decisiones con trazabilidad."
      leftPanelMode="flow"
    >
      <Suspense fallback={null}>
        <LoginClient />
      </Suspense>
    </PublicAuthShell>
  );
}
