import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"), url.origin);

  const cookieStore = await cookies();

  const redirectUrl = new URL(next, url.origin);
  const res = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL(
          `/login?error=exchange_failed&err=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
          url.origin
        )
      );
    }

    return res;
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (error) {
      return NextResponse.redirect(
        new URL(
          `/login?error=verify_failed&err=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
          url.origin
        )
      );
    }

    return res;
  }

  return NextResponse.redirect(
    new URL(`/login?error=missing_auth_params&next=${encodeURIComponent(next)}`, url.origin)
  );
}
