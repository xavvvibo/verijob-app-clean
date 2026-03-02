import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveBaseUrl(req: Request) {
  // Prefer explicit env (dev + prod)
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL;

  if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl.replace(/\/+$/, "");

  // Fallback to request origin (can be wrong behind proxies, hence only fallback)
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  if (host) return `${proto}://${host}`.replace(/\/+$/, "");

  // Last resort for local dev
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  const supabase = await createClient();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const next = String(body?.next || "/dashboard");

  if (!email) {
    return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
  }

  const baseUrl = resolveBaseUrl(req);
  const emailRedirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "otp_send_failed", message: error.message, emailRedirectTo },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, emailRedirectTo });
}
