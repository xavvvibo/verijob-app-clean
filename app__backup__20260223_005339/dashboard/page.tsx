"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!password || password.length < 8) return setMsg({ type: "err", text: "La contraseña debe tener al menos 8 caracteres." });
    if (password !== confirm) return setMsg({ type: "err", text: "Las contraseñas no coinciden." });

    setLoading(true);
    setMsg({ type: "info", text: "Actualizando contraseña…" });

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) return setMsg({ type: "err", text: error.message });

    setMsg({ type: "ok", text: "Contraseña actualizada. Entrando…" });
    window.location.href = "/dashboard";
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: 24, background: "#F7F9FC" }}>
      <div style={{ width: "100%", maxWidth: 520, background: "#fff", border: "1px solid rgba(11,31,59,0.10)", borderRadius: 16, padding: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: "#0B1F3B" }}>Nueva contraseña</h1>
        <p style={{ marginTop: 8, color: "#5B6B7D" }}>Define tu nueva contraseña para recuperar el acceso.</p>

        <label style={{ fontSize: 13, color: "#5B6B7D" }}>Contraseña</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Mínimo 8 caracteres"
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(11,31,59,0.10)", marginTop: 6, marginBottom: 12, outline: "none" }}
        />

        <label style={{ fontSize: 13, color: "#5B6B7D" }}>Confirmar contraseña</label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          type="password"
          placeholder="Repite la contraseña"
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(11,31,59,0.10)", marginTop: 6, marginBottom: 12, outline: "none" }}
        />

        <button
          onClick={save}
          disabled={loading}
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#2F6BFF", color: "white", fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Guardando…" : "Guardar contraseña"}
        </button>

        {msg && (
          <div style={{ marginTop: 12, color: msg.type === "err" ? "#B00020" : msg.type === "ok" ? "#0A7A2F" : "#5B6B7D" }}>
            {msg.text}
          </div>
        )}
      </div>
    </main>
  );
}