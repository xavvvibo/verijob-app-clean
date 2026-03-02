"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL not defined");
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY not defined");

  return createBrowserClient(url, anon);
}
