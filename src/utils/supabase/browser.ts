"use client";

import { createBrowserClient } from "@supabase/ssr";

function setCookie(name: string, value: string, options: any = {}) {
  const opts = {
    path: "/",
    sameSite: "Lax",
    ...options,
  };

  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (opts.maxAge != null) cookie += `; Max-Age=${opts.maxAge}`;
  if (opts.expires) cookie += `; Expires=${opts.expires.toUTCString?.() ?? opts.expires}`;
  if (opts.path) cookie += `; Path=${opts.path}`;
  if (opts.domain) cookie += `; Domain=${opts.domain}`;
  if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
  if (opts.secure) cookie += `; Secure`;

  document.cookie = cookie;
}

function getCookie(name: string) {
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const c of cookies) {
    const [k, ...rest] = c.split("=");
    if (decodeURIComponent(k) === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function removeCookie(name: string, options: any = {}) {
  setCookie(name, "", { ...options, maxAge: 0 });
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient(url, anon, {
    cookies: {
      get(name) {
        return getCookie(name);
      },
      set(name, value, options) {
        setCookie(name, value, options);
      },
      remove(name, options) {
        removeCookie(name, options);
      },
    },
  });
}
