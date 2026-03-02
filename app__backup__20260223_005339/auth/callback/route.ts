import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const errorDesc =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  // si no viene code o hay error -> login
  if (!code) {
    const to = new URL("/login", url.origin);
    if (errorDesc) to.searchParams.set("error", errorDesc);
    return NextResponse.redirect(to);
  }

  // destino final: /dashboard por defecto, pero si viene ?next=... lo respetamos
  const next = url.searchParams.get("next") || "/dashboard";
  const toOk = new URL(next, url.origin);

  const response = NextResponse.redirect(toOk);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const to = new URL("/login", url.origin);
    to.searchParams.set("error", error.message);
    return NextResponse.redirect(to);
  }

  return response;
}