import SignupClient from "./SignupClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";

export const dynamic = "force-dynamic";

export default function SignupPage() {
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
