"use client";

import { useState } from "react";
import { vjEvents } from "@/lib/analytics";
import { createClient } from "@/utils/supabase/browser";

function mapOtpErrorMessage(raw: string | null | undefined) {
  const msg = String(raw || "").trim();
  const normalized = msg.toLowerCase();
  if (!msg) return "No se pudo completar la operación. Inténtalo de nuevo.";
  if (
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("otp_expired") ||
    normalized.includes("token")
  ) {
    return "El código es inválido o ha caducado. Solicita un nuevo código e inténtalo otra vez.";
  }
  if (normalized.includes("rate") || normalized.includes("too many")) {
    return "Has realizado demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }
  return msg;
}

export default function SignupClient() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setIsError(false);

    try {
      const supabase = createClient();
      const cleanEmail = email.trim().toLowerCase();

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
      });

      if (error) {
        setIsError(true);
        setMsg(mapOtpErrorMessage(error.message));
        return;
      }

      vjEvents.signup("candidate");
      setStep("otp");
      setIsError(false);
      setMsg(step === "otp" ? "Hemos reenviado un nuevo código a tu email." : "Código enviado. Revisa tu email.");
    } catch {
      setIsError(true);
      setMsg("Error inesperado enviando código");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setIsError(false);

    try {
      const supabase = createClient();
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = token.trim();

      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: "email",
      });

      if (error) {
        setIsError(true);
        setMsg(mapOtpErrorMessage(error.message));
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setIsError(true);
      setMsg("Error inesperado verificando código");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-[0_12px_32px_rgba(15,23,42,0.10)]">
      <h1 className="text-2xl font-semibold text-slate-900">Crear cuenta</h1>
      <p className="mt-2 text-sm text-slate-500">
        {step === "email"
          ? "Te enviaremos un código para acceder."
          : "Introduce el código que has recibido por email."}
      </p>

      <form
        onSubmit={step === "email" ? sendOtp : verifyCode}
        className="mt-6 space-y-4"
      >
        <label className="block">
          <span className="text-sm text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            disabled={step === "otp"}
            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50"
          />
        </label>

        {step === "otp" ? (
          <label className="block">
            <span className="text-sm text-slate-700">Código</span>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456"
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        ) : null}

        {msg ? (
          <div
            className={`rounded-lg border p-3 text-sm ${
              isError
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {msg}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
            onClick={() =>
              void sendOtp({ preventDefault() {} } as React.FormEvent)
            }
            className="w-full rounded-lg border border-slate-200 bg-white py-3 font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reenviar código
          </button>
        ) : null}
      </form>
    </div>
  );
}
