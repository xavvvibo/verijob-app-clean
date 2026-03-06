"use client";

import { useState } from "react";
import { vjEvents } from "@/lib/analytics";
import { createClient } from "@/utils/supabase/browser";

export default function SignupClient() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const supabase = createClient();
      const cleanEmail = email.trim().toLowerCase();

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
      });

      if (error) {
        setMsg(`Error enviando código (${error.message})`);
        return;
      }

      vjEvents.signup("candidate");
      setStep("otp");
      setMsg("Código enviado. Revisa tu email.");
    } catch {
      setMsg("Error inesperado enviando código");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

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
        setMsg(`Error verificando código (${error.message})`);
        return;
      }

      window.location.href = "/onboarding";
    } catch {
      setMsg("Error inesperado verificando código");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={step === "email" ? sendOtp : verifyCode} style={{ padding: 24, maxWidth: 420 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Crear cuenta</h1>
      <p style={{ marginTop: 8, color: "#444" }}>
        {step === "email"
          ? "Te enviaremos un código para acceder."
          : "Introduce el código que has recibido por email."}
      </p>

      <div style={{ marginTop: 14 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          disabled={step === "otp"}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ccc",
            background: step === "otp" ? "#f9fafb" : "#fff",
          }}
        />
      </div>

      {step === "otp" ? (
        <div style={{ marginTop: 12 }}>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456"
            required
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: 12,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #111",
          background: "#111",
          color: "#fff",
        }}
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
          style={{
            marginTop: 12,
            marginLeft: 8,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#fff",
            color: "#111",
          }}
        >
          Reenviar código
        </button>
      ) : null}

      {msg && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#333" }}>{msg}</p>
      )}
    </form>
  );
}
