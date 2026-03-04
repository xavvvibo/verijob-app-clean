import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isOwner(role: any) {
  return role === "owner";
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const severity = (body?.severity ?? "low") as string;
  const http_status = Number(body?.http_status ?? 0);
  const error_code = (body?.error_code ?? null) as string | null;
  const path = String(body?.path ?? "/");
  const message = String(body?.message ?? "Sin descripción");
  const user_agent = (body?.user_agent ?? null) as string | null;
  const referrer = (body?.referrer ?? null) as string | null;
  const metadata = (body?.metadata ?? {}) as any;

  const { data, error } = await supabase
    .from("issue_reports")
    .insert({
      created_by: user.id,
      severity,
      http_status,
      error_code,
      path,
      message,
      user_agent,
      referrer,
      metadata,
      status: "open",
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...data }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isOwner(profile?.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("issue_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: data ?? [] }, { status: 200 });
}
