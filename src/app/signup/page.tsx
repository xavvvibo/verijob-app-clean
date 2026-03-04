import SignupClient from "./SignupClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <PublicAuthShell
      title="Crea tu cuenta"
      subtitle="Empieza gratis. Sube tu CV y genera tu experiencia estructurada en minutos."
    >
      <SignupClient />
    </PublicAuthShell>
  );
}
