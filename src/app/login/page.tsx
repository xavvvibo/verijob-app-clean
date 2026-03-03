import React from "react";
import LoginClient from "./LoginClient";

// Avoid build-time prerender issues if anything depends on env/session.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginClient />;
}
