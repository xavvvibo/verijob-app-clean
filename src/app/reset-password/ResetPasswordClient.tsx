"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// OJO: No importes supabase client aquí si tu helper lanza error al no encontrar env en build.
// Lo integraremos luego de forma segura.

export default function ResetPasswordClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const accessToken = sp.get("access_token") || "";
  const refreshToken = sp.get("refresh_token") || "";
  const type = sp.get("type") || "";

  const hasTokens = useMemo(() => {
    return accessToken.length > 0 || refreshToken.length > 0 || type.length > 0;
  }, [accessToken, refreshToken, type]);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 8) return setMsg("La contraseña debe tener al menos 8 caracteres.");
    if (password !== password2) return setMsg("Las contraseñas no coinciden.");

    setLoading(true);
    try {
      // TODO: integrar updatePassword con Supabase de forma segura (client-only).
      setMsg("Página de reset activa. Falta integrar el update de contraseña (TODO).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Reset password</h1>

      {!hasTokens && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
          <p style={{ margin: 0 }}>
            No se han detectado parámetros de recuperación en la URL. Abre el enlace completo desde el email.
          </p>
          <button
            onClick={() => router.push("/login")}
            style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc" }}
          >
            Ir a login
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Nueva contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Repite la contraseña</span>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #333" }}
        >
          {loading ? "Procesando..." : "Guardar contraseña"}
        </button>

        {msg && <p style={{ margin: 0 }}>{msg}</p>}
      </form>

      <details style={{ marginTop: 14, opacity: 0.8 }}>
        <summary>Debug</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>
type={type || "(none)"}{"\n"}
access_token={(accessToken && accessToken.slice(0, 12) + "...") || "(none)"}{"\n"}
refresh_token={(refreshToken && refreshToken.slice(0, 12) + "...") || "(none)"}
        </pre>
      </details>
    </main>
  );
}
