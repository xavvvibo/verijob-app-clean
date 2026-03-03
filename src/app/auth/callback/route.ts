import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const supabase = await createServerSupabaseClient();

  // Si ya hay sesión, NO muestres error aunque venga basura en la URL
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(new URL(next, origin));

  if (!code) return NextResponse.redirect(new URL("/login?error=auth_failed", origin));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=auth_failed", origin));

  return NextResponse.redirect(new URL(next, origin));
}
