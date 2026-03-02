"use client";

import { useMemo, useState } from "react";

type Status = "idle" | "loading" | "ready" | "error";

export default function ShareProfileButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010");
    return window.location.origin || (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010");
  }, []);

  const link = useMemo(() => {
    if (!token) return null;
    return `${origin}/p/${token}`;
  }, [origin, token]);

  async function generate() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/candidate/public-link", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Error");
      setToken(body.token);
      setStatus("ready");
    } catch (e: any) {
      setError(e?.message || "Error");
      setStatus("error");
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    alert("Enlace copiado");
  }

  function waUrl() {
    if (!link) return "#";
    const text = encodeURIComponent(`Te comparto mi perfil verificado en Verijob: ${link}`);
    return `https://wa.me/?text=${text}`;
  }

  function mailUrl() {
    if (!link) return "#";
    const subject = encodeURIComponent("Perfil verificado (Verijob)");
    const body = encodeURIComponent(`Te comparto mi perfil verificado en Verijob:\n\n${link}`);
    return `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <button
          className="rounded-md border px-4 py-2 text-sm"
          onClick={generate}
          disabled={status === "loading"}
        >
          {token ? (status === "loading" ? "Regenerando..." : "Regenerar enlace") : (status === "loading" ? "Generando..." : "Generar enlace")}
        </button>

        {link && (
          <button className="rounded-md border px-4 py-2 text-sm" onClick={copy}>
            Copiar enlace
          </button>
        )}

        {link && (
          <a className="rounded-md border px-4 py-2 text-sm" href={waUrl()} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        )}

        {link && (
          <a className="rounded-md border px-4 py-2 text-sm" href={mailUrl()}>
            Email
          </a>
        )}
      </div>

      {link && (
        <div className="mt-3 text-xs break-words">
          <span className="text-gray-600">Enlace:</span> <span className="font-mono">{link}</span>
        </div>
      )}

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {!error && <div className="mt-3 text-xs text-gray-600">Caduca en 7 días.</div>}
    </div>
  );
}
