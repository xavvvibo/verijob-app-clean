import { Suspense } from "react";
import LoginClient from "./LoginClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";

export const dynamic = "force-dynamic";

export default function LoginPage() {
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
