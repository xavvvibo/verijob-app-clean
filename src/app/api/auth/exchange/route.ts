import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

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

function safeNext(raw: string | null, origin: string) {
  const fallback = "/candidate/overview";

  if (!raw) return fallback;

  try {
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    const u = new URL(raw, origin);
    if (u.origin !== origin) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const urlObj = new URL(request.url);
  const origin = urlObj.origin;

  const code = urlObj.searchParams.get("code");
  const next = safeNext(urlObj.searchParams.get("next"), origin);

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=missing_code&next=${encodeURIComponent(next)}`, origin));
  }

  const { url, anon } = getSupabaseEnv();
  if (!url || !anon) {
    return NextResponse.redirect(new URL(`/login?error=missing_env&next=${encodeURIComponent(next)}`, origin));
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
    return NextResponse.redirect(
      new URL(
        `/login?error=exchange_failed&err=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
        origin
      )
    );
  }

  return response;
}
