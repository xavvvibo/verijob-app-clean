"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function parseHashTokens() {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  if (!hash || !hash.startsWith("#")) return null;

  const params = new URLSearchParams(hash.slice(1));
  const access_token = params.get("access_token") || "";
  const refresh_token = params.get("refresh_token") || "";

  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failDebug, setFailDebug] = useState<string | null>(null);

  const next = useMemo(() => searchParams.get("next") ?? "/dashboard", [searchParams]);
  const code = useMemo(() => searchParams.get("code"), [searchParams]);

  useEffect(() => {
    const run = async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const key =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_KEY ||
        "";

      const tokens = parseHashTokens();

      const diag = [
        `has_code=${code ? "1" : "0"}`,
        `has_hash_tokens=${tokens ? "1" : "0"}`,
        `has_env_url=${url ? "1" : "0"}`,
        `has_env_key=${key ? "1" : "0"}`,
        `next=${encodeURIComponent(next)}`,
      ].join("&");

      if (!url || !key) {
        setFailDebug(`missing_env&${diag}`);
        return;
      }

      const supabase = createClient(url, key);

      // PKCE code flow
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setFailDebug(`exchange_failed&err=${encodeURIComponent(error.message)}&${diag}`);
          return;
        }
        router.replace(next);
        return;
      }

      // Hash tokens flow -> set cookies via server endpoint (para SSR)
      if (tokens) {
        const r = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(tokens),
        });

        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setFailDebug(`session_cookie_failed&err=${encodeURIComponent(j?.error || "unknown")}&${diag}`);
          return;
        }

        // Limpia hash para evitar re-proceso
        if (typeof window !== "undefined" && window.location.hash) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }

        router.replace(next);
        return;
      }

      setFailDebug(`no_code_no_hash&${diag}`);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failDebug) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <div className="font-medium mb-2">Auth callback: fallo</div>
          <div className="text-gray-600 mb-3">Copia este debug y pégamelo tal cual:</div>
          <pre className="rounded bg-gray-50 p-3 overflow-auto border border-gray-200">{failDebug}</pre>
          <div className="mt-4">
            <button
              className="rounded border px-3 py-2"
              onClick={() => router.replace(`/login?error=auth_failed&debug=${encodeURIComponent(failDebug)}`)}
            >
              Ir a login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm text-gray-600">
      Verificando acceso…
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-sm text-gray-600">
          Verificando acceso…
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
