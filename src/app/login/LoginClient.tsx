"use client";

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!supabaseUrl || !supabaseAnonKey) {
      setMsg("Faltan variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Refresh to let server-side auth guards pick up the session
      window.location.href = "/dashboard";
    } catch (err: any) {
      setMsg(err?.message ?? "Error de login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "48px 16px" }}>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>Iniciar sesión</div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "rgba(100,116,139,1)" }}>
        Acceso a Verijob
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(100,116,139,1)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              fontWeight: 800,
              outline: "none",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(100,116,139,1)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            Contraseña
          </span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              fontWeight: 800,
              outline: "none",
            }}
          />
        </label>

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
          {loading ? "Entrando..." : "Entrar"}
        </button>

        {msg ? (
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: "rgba(185,28,28,1)" }}>{msg}</div>
        ) : null}
      </form>
    </div>
  );
}
