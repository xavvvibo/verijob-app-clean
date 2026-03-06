"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ResetClient() {
  const supabase = createClient();
  const sp = useSearchParams();

  const accessToken = sp ? sp.get("access_token") || "" : "";
  const refreshToken = sp ? sp.get("refresh_token") || "" : "";
  const type = sp ? sp.get("type") || "" : "";

  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    try {
      setBusy(true);
      setMsg(null);

      if (!accessToken || !refreshToken || type !== "recovery") {
        throw new Error("Enlace de recuperación inválido.");
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      setMsg("Contraseña actualizada correctamente.");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo actualizar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Restablecer contraseña</h1>

      <input
        type="password"
        className="w-full rounded border px-3 py-2"
        placeholder="Nueva contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? "Actualizando..." : "Actualizar contraseña"}
      </button>

      {msg ? <p className="text-sm">{msg}</p> : null}
    </div>
  );
}
