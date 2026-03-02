"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Mode = "candidate" | "company";
type Tab = "magic" | "password";
type PasswordMode = "signin" | "signup";

function clampEmail(v: string) {
  return v.trim().toLowerCase();
}

function getRedirectTo() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.startsWith("http")
      ? process.env.NEXT_PUBLIC_SITE_URL
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  return `${base}/auth/callback`;
}

export default function LoginClient() {
  const params = useSearchParams();
  const mode = (params.get("as") as Mode) || "candidate";

  const [tab, setTab] = useState<Tab>("magic");
  const [pwdMode, setPwdMode] = useState<PasswordMode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [msg, setMsg] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const isCoolingDown = cooldownUntil ? Date.now() < cooldownUntil : false;
  const cooldownSeconds = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0;

  const title = mode === "company" ? "Acceso para empresas" : "Acceso para candidatos";
  const subtitle =
    mode === "company"
      ? "Verifica experiencia laboral con consentimiento y evidencias."
      : "Crea tu perfil verificable y comparte credenciales fiables.";

  const bg = "#F7F9FC";
  const navy = "#0B1F3B";
  const muted = "#5B6B7D";
  const accent = "#2F6BFF";
  const card = "#FFFFFF";
  const border = "rgba(11,31,59,0.10)";

  async function sendMagicLink() {
    const clean = clampEmail(email);
    if (!clean || !clean.includes("@")) return setMsg({ type: "err", text: "Introduce un email válido." });

    setLoading(true);
    setMsg({ type: "info", text: "Enviando enlace seguro…" });

    const redirectTo = getRedirectTo();

    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);

    if (error) {
      setMsg({ type: "err", text: error.message });
      // Evitar martillar el endpoint y comerte rate limit
      setCooldownUntil(Date.now() + 60_000);
      return;
    }

    setMsg({ type: "ok", text: "Revisa tu email. Te hemos enviado un enlace para iniciar sesión." });
    setCooldownUntil(Date.now() + 30_000);
  }

  async function signInPassword() {
    const clean = clampEmail(email);
    if (!clean || !clean.includes("@")) return setMsg({ type: "err", text: "Introduce un email válido." });
    if (!password || password.length < 8) return setMsg({ type: "err", text: "La contraseña debe tener al menos 8 caracteres." });

    setLoading(true);
    setMsg({ type: "info", text: "Iniciando sesión…" });

    const { error } = await supabase.auth.signInWithPassword({
      email: clean,
      password,
    });

    setLoading(false);

    if (error) return setMsg({ type: "err", text: error.message });

    window.location.href = "/dashboard";
  }

  async function signUpPassword() {
    const clean = clampEmail(email);
    if (!clean || !clean.includes("@")) return setMsg({ type: "err", text: "Introduce un email válido." });
    if (!password || password.length < 8) return setMsg({ type: "err", text: "La contraseña debe tener al menos 8 caracteres." });
    if (password !== confirm) return setMsg({ type: "err", text: "Las contraseñas no coinciden." });

    setLoading(true);
    setMsg({ type: "info", text: "Creando cuenta…" });

    const redirectTo = getRedirectTo();

    const { error } = await supabase.auth.signUp({
      email: clean,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { role: mode }, // opcional: guardas intención
      },
    });

    setLoading(false);

    if (error) {
      setMsg({ type: "err", text: error.message });
      // Muy típico: "email rate exceeded"
      setCooldownUntil(Date.now() + 120_000);
      return;
    }

    setMsg({ type: "ok", text: "Cuenta creada. Revisa tu email para confirmar y activar el acceso." });
    setCooldownUntil(Date.now() + 30_000);
  }

  const action =
    tab === "magic"
      ? sendMagicLink
      : pwdMode === "signin"
        ? signInPassword
        : signUpPassword;

  const actionLabel =
    tab === "magic"
      ? "Enviar enlace"
      : pwdMode === "signin"
        ? "Entrar"
        : "Registrarme";

  return (
    <main style={{ minHeight: "100vh", background: bg, display: "flex", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Image src="/verijob-logo.png" alt="Verijob" width={150} height={44} priority />
        </div>

        <h1 style={{ margin: 0, fontSize: 34, color: navy }}>{title}</h1>
        <p style={{ marginTop: 8, color: muted }}>{subtitle}</p>

        <div style={{ marginTop: 18, background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setTab("magic")}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${tab === "magic" ? accent : border}`,
                background: tab === "magic" ? "#EEF3FF" : "transparent",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Enlace por email
            </button>
            <button
              onClick={() => setTab("password")}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${tab === "password" ? accent : border}`,
                background: tab === "password" ? "#EEF3FF" : "transparent",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Contraseña
            </button>
          </div>

          {tab === "password" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setPwdMode("signin")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: `1px solid ${pwdMode === "signin" ? accent : border}`,
                  background: pwdMode === "signin" ? "#EEF3FF" : "transparent",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Entrar
              </button>
              <button
                onClick={() => setPwdMode("signup")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: `1px solid ${pwdMode === "signup" ? accent : border}`,
                  background: pwdMode === "signup" ? "#EEF3FF" : "transparent",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Registrarse
              </button>
            </div>
          )}

          <label style={{ fontSize: 13, color: muted }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${border}`,
              marginTop: 6,
              marginBottom: 12,
              outline: "none",
            }}
          />

          {tab === "password" && (
            <>
              <label style={{ fontSize: 13, color: muted }}>Contraseña</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="********"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${border}`,
                  marginTop: 6,
                  marginBottom: 12,
                  outline: "none",
                }}
              />

              {pwdMode === "signup" && (
                <>
                  <label style={{ fontSize: 13, color: muted }}>Confirmar contraseña</label>
                  <input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    type="password"
                    placeholder="********"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${border}`,
                      marginTop: 6,
                      marginBottom: 12,
                      outline: "none",
                    }}
                  />
                </>
              )}
            </>
          )}

          <button
            onClick={action}
            disabled={loading || isCoolingDown}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: "none",
              background: accent,
              color: "white",
              fontWeight: 900,
              cursor: loading || isCoolingDown ? "not-allowed" : "pointer",
              opacity: loading || isCoolingDown ? 0.7 : 1,
            }}
          >
            {loading ? "Procesando…" : isCoolingDown ? `Espera ${cooldownSeconds}s` : actionLabel}
          </button>

          {msg && (
            <div style={{ marginTop: 12, color: msg.type === "err" ? "#B00020" : msg.type === "ok" ? "#0A7A2F" : muted }}>
              {msg.text}
            </div>
          )}

          {tab === "password" && pwdMode === "signin" && (
            <div style={{ marginTop: 12, fontSize: 13, color: muted }}>
              Si olvidaste tu contraseña, usa “Enlace por email” para entrar y luego podrás cambiarla desde tu cuenta (lo afinamos después).
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
