"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Mode = "magic" | "password";

export default function LoginClient() {
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
      },
    });
  }, [supabaseUrl, supabaseAnonKey]);

  async function setSsrCookiesFromTokens(access_token?: string, refresh_token?: string) {
    if (!access_token || !refresh_token) throw new Error("Missing session tokens");

    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token, refresh_token }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || "No se pudo fijar la sesión (cookies)");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!supabase) {
      setMsg("Faltan variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const next = "/dashboard";
    setLoading(true);

    try {
      if (mode === "magic") {
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setMsg("Te hemos enviado un enlace de acceso. Revisa tu email (y spam).");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        await setSsrCookiesFromTokens(data.session?.access_token, data.session?.refresh_token);
        window.location.href = next;
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Error de login");
    } finally {
      setLoading(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    fontWeight: 950,
    cursor: "pointer",
    background: active ? "#111827" : "#FFFFFF",
    color: active ? "#FFFFFF" : "#111827",
  });

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "48px 16px" }}>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>Iniciar sesión</div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "rgba(100,116,139,1)" }}>
        Acceso a Verijob
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button type="button" onClick={() => setMode("magic")} style={tabStyle(mode === "magic")}>
          Magic link
        </button>
        <button type="button" onClick={() => setMode("password")} style={tabStyle(mode === "password")}>
          Contraseña
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(100,116,139,1)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              fontWeight: 800,
              outline: "none",
            }}
          />
        </label>

        {mode === "password" && (
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(100,116,139,1)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Contraseña
            </span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.25)",
                fontWeight: 800,
                outline: "none",
              }}
            />
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 12,
            border: 0,
            color: "white",
            fontWeight: 950,
            cursor: "pointer",
            background: "linear-gradient(90deg, #1d4ed8 0%, #4f46e5 70%, #6d28d9 100%)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Procesando..." : mode === "magic" ? "Enviar enlace" : "Entrar"}
        </button>

        {msg ? (
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: msg.includes("enviado") ? "rgba(21,128,61,1)" : "rgba(185,28,28,1)" }}>
            {msg}
          </div>
        ) : null}
      </form>
    </div>
  );
}
