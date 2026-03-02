"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setMsg(null);

    if (!p1 || p1.length < 8) return setMsg("La contraseña debe tener al menos 8 caracteres.");
    if (p1 !== p2) return setMsg("Las contraseñas no coinciden.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setLoading(false);

    if (error) return setMsg(error.message);

    router.replace("/dashboard");
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1>Restablecer contraseña</h1>
      <p>Elige una nueva contraseña para tu cuenta.</p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          type="password"
          placeholder="Nueva contraseña (mín. 8)"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          style={{ padding: 12, fontSize: 16 }}
        />
        <input
          type="password"
          placeholder="Repite la contraseña"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          style={{ padding: 12, fontSize: 16 }}
        />

        <button onClick={save} disabled={loading} style={{ padding: 12, fontSize: 16 }}>
          {loading ? "Guardando..." : "Guardar y entrar"}
        </button>

        {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      </div>
    </main>
  );
}
