"use client";

import { useMemo, useState } from "react";

export default function ShareLinkButton({ verificationId }: { verificationId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const publicUrl = useMemo(() => {
    if (!token) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/v/${token}`;
  }, [token]);

  async function generate() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/verification/${verificationId}/public-link`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed");
      setToken(body.token);
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Error");
    }
  }

  async function copy() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    alert("Enlace copiado");
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        onClick={generate}
        disabled={status === "loading"}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "transparent",
          cursor: status === "loading" ? "not-allowed" : "pointer",
        }}
      >
        {token ? "Regenerar enlace" : status === "loading" ? "Generando..." : "Compartir verificación"}
      </button>

      {publicUrl ? (
        <>
          <a href={publicUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
            {publicUrl}
          </a>
          <button
            onClick={copy}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Copiar
          </button>
        </>
      ) : null}

      {status === "error" ? <span style={{ opacity: 0.85 }}>Error: {error}</span> : null}
    </div>
  );
}
