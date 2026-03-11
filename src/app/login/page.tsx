import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth?.user) redirect("/dashboard");

  return (
    <PublicAuthShell
      title="Accede a tu perfil profesional verificable"
      subtitle="Entra con código por email para gestionar verificaciones, evidencias y compartir tu perfil."
      leftPanelMode="flow"
    >
      <Suspense fallback={null}>
        <LoginClient />
      </Suspense>
    </PublicAuthShell>
  );
}
