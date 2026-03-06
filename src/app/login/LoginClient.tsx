"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/browser";

function safeNext(raw: string | null) {
  const fallback = "/candidate/overview";
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

export default function LoginClient() {
  const sp = useSearchParams();
  const next = useMemo(() => safeNext(sp.get("next")), [sp]);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);

    const v = email.trim().toLowerCase();
    if (!v) {
      setError("Introduce tu email.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");

      const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: v,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Accede a Verijob</h1>
        <p className="text-sm text-gray-500 mt-2">
          Te enviaremos un enlace de acceso por email.
        </p>

        <form onSubmit={sendMagicLink} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </label>

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {sent ? (
            <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-sm text-green-700">
              Enlace enviado. Abre el email en este mismo navegador y completa el acceso.
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 text-white font-medium py-3 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
      </div>
    </div>
  );
}
