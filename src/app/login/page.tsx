import { Suspense } from "react";
import LoginClient from "./LoginClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";

export default function LoginPage() {
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
