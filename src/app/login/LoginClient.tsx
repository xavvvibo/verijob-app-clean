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
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = email.trim().toLowerCase();
    if (!v) {
      setError("Introduce tu email.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email: v,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setStep("otp");
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = email.trim().toLowerCase();
    const code = token.trim();

    if (!v) {
      setError("Falta el email.");
      return;
    }

    if (!code) {
      setError("Introduce el código.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.verifyOtp({
        email: v,
        token: code,
        type: "email",
      });

      if (error) {
        setError(error.message);
        return;
      }

      window.location.href = next;
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
          {step === "email"
            ? "Te enviaremos un código de acceso por email."
            : "Introduce el código que has recibido en tu email."}
        </p>

        <form onSubmit={step === "email" ? sendOtp : verifyOtp} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              disabled={step === "otp"}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-gray-50"
            />
          </label>

          {step === "otp" ? (
            <label className="block">
              <span className="text-sm text-gray-700">Código</span>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </label>
          ) : null}

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 text-white font-medium py-3 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading
              ? "Procesando…"
              : step === "email"
                ? "Enviar código"
                : "Verificar código"}
          </button>

          {step === "otp" ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void sendOtp({ preventDefault() {} } as React.FormEvent)}
              className="w-full rounded-xl bg-white border border-gray-200 text-gray-900 font-medium py-3 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              Reenviar código
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
