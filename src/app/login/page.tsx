import React from "react";
import LoginClient from "./LoginClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <PublicAuthShell
      title="Inicia sesión"
      subtitle="Accede a tu perfil y gestiona tus verificaciones en un entorno seguro."
    >
      <LoginClient />
    </PublicAuthShell>
  );
}
