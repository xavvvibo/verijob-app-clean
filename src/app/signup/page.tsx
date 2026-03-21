import SignupClient from "./SignupClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";

export const dynamic = "force-dynamic";

export default function SignupPage() {
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
