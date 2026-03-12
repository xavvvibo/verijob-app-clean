"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/browser";

function safeNext(raw: string | null) {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

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

export default function LoginCard() {
  const sp = useSearchParams();
  const mode = sp.get("mode");
  const rawNext = sp.get("next");
  const next = useMemo(() => safeNext(rawNext), [rawNext]);
  const signupHref = useMemo(() => {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    if (rawNext) params.set("next", next);
    const qs = params.toString();
    return qs ? `/signup?${qs}` : "/signup";
  }, [mode, rawNext, next]);

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const v = email.trim().toLowerCase();
    if (!v) {
      setError("Introduce tu email.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email: v });
      if (error) {
        setError(mapOtpErrorMessage(error.message));
        return;
      }
      setStep("otp");
      setNotice(step === "otp" ? "Hemos reenviado un nuevo código a tu email." : "Código enviado. Revisa tu correo.");
    } catch (err: any) {
      setError(mapOtpErrorMessage(err?.message ?? "Error inesperado."));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

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
        setError(mapOtpErrorMessage(error.message));
        return;
      }

      window.location.href = next;
    } catch (err: any) {
      setError(mapOtpErrorMessage(err?.message ?? "Error inesperado."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-[0_12px_32px_rgba(15,23,42,0.10)]">
      <h1 className="text-2xl font-semibold text-slate-900">Accede a Verijob</h1>

      <form onSubmit={step === "email" ? sendOtp : verifyOtp} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-slate-700">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            disabled={step === "otp"}
            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50"
          />
        </label>

        {step === "otp" ? (
          <label className="block">
            <span className="text-sm text-slate-700">Código</span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>
        ) : null}

        <button
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Procesando…" : "Continuar"}
        </button>

        {step === "otp" ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void sendOtp({ preventDefault() {} } as React.FormEvent)}
            className="w-full rounded-lg border border-slate-200 bg-white py-3 font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reenviar código
          </button>
        ) : null}
      </form>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Acceso disponible mediante código enviado por email.
      </div>

      <div className="mt-6 space-y-2 text-sm text-slate-600">
        <p>
          ¿No tienes cuenta?{" "}
          <Link href={signupHref} className="font-medium text-blue-700 hover:text-blue-800">
            Crear cuenta
          </Link>
        </p>
        <p>
          <Link href="/reset-password" className="font-medium text-slate-700 hover:text-slate-900">
            Olvidé contraseña
          </Link>
        </p>
      </div>
    </div>
  );
}
