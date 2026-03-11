import SignupClient from "./SignupClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth?.user) redirect("/dashboard");

  return (
    <PublicAuthShell
      title="Activa tu acceso a VERIJOB en minutos"
      subtitle="Empieza por email y deja preparado tu entorno como candidato o empresa, con acceso inmediato y seguro."
      leftPanelMode="bullets"
      signupBullets={[
        "Alta rápida por email",
        "Perfil verificable",
        "Evidencias documentales",
        "Acceso para candidato y empresa",
      ]}
    >
      <SignupClient />
    </PublicAuthShell>
  );
}
