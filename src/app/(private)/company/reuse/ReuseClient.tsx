"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ReuseClient() {
  const sp = useSearchParams();
  const id = useMemo(() => {
    return sp ? (sp.get("id") || sp.get("verification_id") || "") : "";
  }, [sp]);

  const [value, setValue] = useState(id);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    try {
      setBusy(true);
      setMsg(null);

      const verificationId = (value || "").trim();
      if (!verificationId) {
        setMsg("Falta el identificador de verificación.");
        return;
      }

      const res = await fetch("/api/company/reuse", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          verification_id: verificationId,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Error reutilizando verificación.");
      }

      setMsg("Verificación reutilizada correctamente.");
    } catch (e: any) {
      setMsg(e?.message || "Error reutilizando verificación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Verification ID
        </label>
        <input
          className="w-full rounded border px-3 py-2"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="verification_id"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? "Procesando..." : "Reutilizar"}
      </button>

      {msg ? <p className="text-sm">{msg}</p> : null}
    </div>
  );
}
