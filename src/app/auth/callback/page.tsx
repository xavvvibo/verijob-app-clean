"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/browser";
import type { EmailOtpType } from "@supabase/supabase-js";

function safeNext(raw: string | null) {
  const fallback = "/candidate/overview";
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completando acceso…");
  const [error, setError] = useState<string | null>(null);

  const next = useMemo(() => {
    if (typeof window === "undefined") return "/candidate/overview";
    const url = new URL(window.location.href);
    return safeNext(url.searchParams.get("next"));
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const search = url.searchParams;
        const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

        const code = search.get("code");
        const token_hash = search.get("token_hash");
        const type = search.get("type") as EmailOtpType | null;

        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");

        if (code) {
          setMessage("Validando enlace…");
          window.location.replace(`/api/auth/exchange?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
          return;
        }

        if (token_hash && type) {
          setMessage("Verificando acceso…");
          const supabase = createClient();
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });

          if (error) throw error;

          window.location.replace(next);
          return;
        }

        if (access_token && refresh_token) {
          setMessage("Creando sesión…");

          const res = await fetch("/api/auth/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ access_token, refresh_token }),
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            throw new Error(data?.error || "session_failed");
          }

          window.location.replace(next);
          return;
        }

        throw new Error("missing_auth_params");
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "No se pudo completar el acceso");
        setMessage("No se pudo completar el acceso.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [next]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Acceso a Verijob</h1>
        <p className="text-sm text-gray-500 mt-2">{message}</p>

        {error ? (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex rounded-xl bg-blue-600 text-white font-medium px-4 py-3 hover:bg-blue-700 transition"
          >
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
}
