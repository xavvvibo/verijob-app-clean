import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, supabase, user: null };

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (pErr) return { ok: false as const, status: 500, supabase, user };
  if (profile?.role !== "owner") return { ok: false as const, status: 403, supabase, user };

  return { ok: true as const, supabase, user };
}

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { data, error } = await auth.supabase
    .from("admin_issue_reports")
    .select("id, created_at, severity, http_status, error_code, path, method, request_id, message_short, resolved_at, resolution_note, user_email, user_role")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] }, { status: 200 });
}

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const payload = {
    created_by: auth.user!.id,
    severity: String(body?.severity ?? "medium"),
    http_status: body?.http_status ?? null,
    error_code: body?.error_code ?? null,
    path: body?.path ?? null,
    method: body?.method ?? null,
    request_id: body?.request_id ?? null,
    message_short: String(body?.message_short ?? "").slice(0, 280),
    details_json: body?.details_json ?? {},
    user_email: body?.user_email ?? null,
    user_role: body?.user_role ?? null,
  };

  if (!payload.message_short) {
    return NextResponse.json({ error: "message_short_required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("admin_issue_reports")
    .insert(payload)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data?.id }, { status: 201 });
}
