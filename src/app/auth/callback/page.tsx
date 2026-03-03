"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function getSupabasePublicEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY || // fallback común en algunos setups
    "";

  return { url, key };
}

function parseHashTokens() {
  // hash típico: #access_token=...&refresh_token=...&expires_in=...&token_type=bearer&type=magiclink
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

  useEffect(() => {
    const run = async () => {
      const next = searchParams.get("next") ?? "/dashboard";
      const code = searchParams.get("code");

      const { url, key } = getSupabasePublicEnv();
      if (!url || !key) {
        router.replace("/login?error=auth_failed");
        return;
      }

      const supabase = createBrowserClient(url, key);

      // 1) Prefer PKCE code
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace("/login?error=auth_failed");
          return;
        }
        router.replace(next);
        return;
      }

      // 2) Fallback: tokens en hash
      const tokens = parseHashTokens();
      if (tokens) {
        const { error } = await supabase.auth.setSession(tokens);
        if (error) {
          router.replace("/login?error=auth_failed");
          return;
        }
        router.replace(next);
        return;
      }

      // 3) Nada usable -> fail
      router.replace("/login?error=auth_failed");
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
