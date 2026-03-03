"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function LoginInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const errorParam = searchParams.get("error");
  const debugParam = searchParams.get("debug");

  const origin = useMemo(() => {
    return typeof window !== "undefined" ? window.location.origin : "https://app.verijob.es";
  }, []);

  const redirectTo = useMemo(() => `${origin}/auth/callback?next=%2Fdashboard`, [origin]);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_KEY ||
      "";
    return createClient(url, key);
  }, []);

  useEffect(() => {
    if (errorParam) {
      setSent(false);
      setBusy(false);
    }
  }, [errorParam]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSent(false);

    const v = email.trim().toLowerCase();
    if (!v || !v.includes("@")) {
      setErr("Introduce un email válido.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: v,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setErr(error.message);
        return;
      }

      setSent(true);
    } catch (e2) {
      setErr(String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Acceso</h1>
        <p className="mt-1 text-sm text-gray-600">Te enviaremos un enlace mágico por email.</p>

        {errorParam && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Error de autenticación. Vuelve a solicitar el enlace.
            {debugParam ? (
              <div className="mt-2 text-xs text-red-600 break-words">debug: {debugParam}</div>
            ) : null}
          </div>
        )}

        {err && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {sent && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Enlace enviado. Ábrelo desde este mismo navegador.
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <label className="block text-sm font-medium">Email</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md border border-gray-300 bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? "Enviando…" : "Enviar enlace"}
          </button>

          <p className="text-xs text-gray-500">
            Importante: abre el enlace desde el mismo navegador donde lo pediste.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center p-6 text-sm text-gray-600">
          Cargando…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
