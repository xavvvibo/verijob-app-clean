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
