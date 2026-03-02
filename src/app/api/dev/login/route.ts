import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // HARD STOP in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  // Best-effort: restrict to localhost requests
  const host = req.headers.get("host") || "";
  const forwardedHost = req.headers.get("x-forwarded-host") || "";
  const effectiveHost = forwardedHost || host;
  const isLocal =
    effectiveHost.includes("localhost") ||
    effectiveHost.includes("127.0.0.1") ||
    effectiveHost.includes("0.0.0.0");

  if (!isLocal) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body?.email || "");
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email/password" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: "Login failed", detail: error }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user_id: data.user?.id ?? null,
  });
}
