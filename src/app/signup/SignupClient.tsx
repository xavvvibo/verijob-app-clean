"use client";

import { useState } from "react";

export default function SignupClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, next: "/onboarding" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(`Error enviando enlace (${data?.error ?? "unknown"})`);
        return;
      }

      setMsg("Enlace enviado. Revisa tu email.");
    } catch {
      setMsg("Error inesperado enviando enlace");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ padding: 24, maxWidth: 420 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Crear cuenta</h1>
      <p style={{ marginTop: 8, color: "#444" }}>Te enviaremos un enlace para confirmar.</p>

      <div style={{ marginTop: 14 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
        />
      </div>

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
        {loading ? "Enviando…" : "Enviar magic link"}
      </button>

      {msg && <p style={{ marginTop: 12, fontSize: 13, color: "#333" }}>{msg}</p>}
    </form>
  );
}
