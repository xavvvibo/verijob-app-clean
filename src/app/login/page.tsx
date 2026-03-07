import React from "react";
import LoginClient from "./LoginClient";
import PublicAuthShell from "@/components/public/PublicAuthShell";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <PublicAuthShell
      title="Perfiles profesionales verificables"
      subtitle="Verijob permite crear y consultar perfiles profesionales verificables que las empresas pueden comprobar en segundos."
      leftPanelMode="flow"
    >
      <LoginClient />
    </PublicAuthShell>
  );
}
