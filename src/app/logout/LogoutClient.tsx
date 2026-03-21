"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LogoutClient() {
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const supabase = createClient();
        await supabase.auth.signOut().catch(() => null);
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
      } finally {
        if (!alive) return;
        window.location.replace("/login?logout=1");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Cerrando sesión</h1>
        <p className="mt-3 text-sm text-slate-600">
          Estamos cerrando tu acceso para que puedas volver a entrar con la cuenta que quieras.
        </p>
      </div>
    </div>
  );
}
