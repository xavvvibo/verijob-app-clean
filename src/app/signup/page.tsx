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
      title="Crea tu perfil profesional verificable"
      subtitle="Verifica tu experiencia laboral y comparte un perfil que las empresas pueden comprobar."
      leftPanelMode="bullets"
      signupBullets={[
        "Experiencias verificadas",
        "Evidencias profesionales",
        "Trust Score verificable",
        "Perfil compartible",
      ]}
    >
      <SignupClient />
    </PublicAuthShell>
  );
}
