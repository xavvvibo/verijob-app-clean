"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"working" | "fail">("working");
  const [debug, setDebug] = useState<string>("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
      },
    });
  }, [supabaseUrl, supabaseAnonKey]);

  function parseHashTokens() {
    const h = (window.location.hash || "").replace(/^#/, "");
    const params = new URLSearchParams(h);
    const access_token = params.get("access_token") || undefined;
    const refresh_token = params.get("refresh_token") || undefined;
    return { access_token, refresh_token, has: Boolean(access_token && refresh_token) };
  }

  async function setSsrCookies(access_token?: string, refresh_token?: string) {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token, refresh_token }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || "No se pudo fijar la sesión (cookies)");
  }

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const next = url.searchParams.get("next") || "/dashboard";

        const hasEnvUrl = Boolean(supabaseUrl);
        const hasEnvKey = Boolean(supabaseAnonKey);
        const hasCode = Boolean(code);

        const hash = parseHashTokens();
        const hasHashTokens = hash.has;

        if (!supabase || !hasEnvUrl || !hasEnvKey) {
          setStatus("fail");
          setDebug(`missing_env&has_env_url=${hasEnvUrl ? 1 : 0}&has_env_key=${hasEnvKey ? 1 : 0}&next=${encodeURIComponent(next)}`);
          return;
        }

        // Path A: PKCE code in query
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error || !data?.session) {
            setStatus("fail");
            setDebug(
              `exchange_failed&err=${encodeURIComponent(error?.message || "no_session")}` +
                `&has_code=${hasCode ? 1 : 0}` +
                `&has_hash_tokens=${hasHashTokens ? 1 : 0}` +
                `&has_env_url=${hasEnvUrl ? 1 : 0}` +
                `&has_env_key=${hasEnvKey ? 1 : 0}` +
                `&next=${encodeURIComponent(next)}`
            );
            return;
          }

          await setSsrCookies(data.session.access_token, data.session.refresh_token);
          window.location.replace(next);
          return;
        }

        // Path B: implicit/hash tokens
        if (hasHashTokens) {
          await setSsrCookies(hash.access_token, hash.refresh_token);
          // clean URL hash
          window.history.replaceState({}, document.title, `${url.pathname}?next=${encodeURIComponent(next)}`);
          window.location.replace(next);
          return;
        }

        setStatus("fail");
        setDebug(`missing_code&has_code=0&has_hash_tokens=0&next=${encodeURIComponent(next)}`);
      } catch (e: any) {
        setStatus("fail");
        setDebug(`callback_exception&err=${encodeURIComponent(e?.message || "unknown")}`);
      }
    })();
  }, [supabase, supabaseUrl, supabaseAnonKey]);

  return (
    <div style={{ padding: 40 }}>
      {status === "working" && <div>Autenticando…</div>}
      {status === "fail" && (
        <div>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Auth callback: fallo</div>
          <div style={{ marginBottom: 10 }}>Copia este debug y pégamelo tal cual:</div>
          <pre style={{ padding: 12, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12 }}>{debug}</pre>
          <a href="/login" style={{ display: "inline-block", marginTop: 12 }}>Ir a login</a>
        </div>
      )}
    </div>
  );
}
