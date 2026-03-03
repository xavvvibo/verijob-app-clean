import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";

  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  return { url, anon };
}

export async function GET(request: Request) {
  const urlObj = new URL(request.url);
  const origin = urlObj.origin;

  const code = urlObj.searchParams.get("code");
  const next = urlObj.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  const { url, anon } = getSupabaseEnv();
  if (!url || !anon) {
    console.error("auth_exchange_missing_env", {
      hasUrl: Boolean(url),
      hasAnon: Boolean(anon),
    });
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  let response = NextResponse.redirect(new URL(next, origin));
  const cookieStore = await cookies();

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth_exchange_exchange_error", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  return response;
}
