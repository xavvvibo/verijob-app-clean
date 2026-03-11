"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { vjEvents } from "@/lib/analytics";
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

export default function SignupClient() {
  const sp = useSearchParams();
  const mode = sp.get("mode");
  const rawNext = sp.get("next");
  const next = useMemo(() => safeNext(rawNext), [rawNext]);
  const loginHref = useMemo(() => {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    if (rawNext) params.set("next", next);
    const qs = params.toString();
    return qs ? `/login?${qs}` : "/login";
  }, [mode, rawNext, next]);
  const isCompanyMode = mode === "company";

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

      vjEvents.signup(isCompanyMode ? "company" : "candidate");
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

      window.location.href = next;
    } catch {
      setIsError(true);
      setMsg("Error inesperado verificando código");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-[0_12px_32px_rgba(15,23,42,0.10)]">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {isCompanyMode ? "Alta empresa" : "Alta candidato"}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          Acceso por código seguro
        </span>
      </div>

      <h1 className="text-2xl font-semibold text-slate-900">
        {isCompanyMode ? "Activar cuenta de empresa" : "Crear cuenta en VERIJOB"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        {step === "email"
          ? "Empieza sin contraseña. Te enviaremos un código por email para activar el acceso."
          : "Introduce el código recibido para completar el acceso a tu entorno VERIJOB."}
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
          className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        {isCompanyMode
          ? "Crear tu acceso de empresa no requiere tarjeta y te permite gestionar verificaciones desde el primer día."
          : "Tu cuenta te permite construir un perfil verificable y compartirlo con empresas con más contexto."}
      </div>

      <div className="mt-5 text-sm text-slate-600">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={loginHref}
          className="font-medium text-blue-700 hover:text-blue-800"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
