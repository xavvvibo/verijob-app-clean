import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: "unauthorized" });

  const unreadRes = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  const listRes = await supabase
    .from("notifications")
    .select("id,type,title,body,read,entity_type,entity_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  if (listRes.error) return json(400, { error: "notifications_read_failed", detail: listRes.error.message });

  return json(200, {
    unread_count: unreadRes.count || 0,
    items: listRes.data || [],
  });
}

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => ({} as any));
  const markAllRead = Boolean(body?.mark_all_read);
  const notificationId = String(body?.id || "").trim();

  if (markAllRead) {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) return json(400, { error: "notifications_mark_all_failed", detail: error.message });
    return json(200, { ok: true });
  }

  if (!notificationId) return json(400, { error: "missing_id" });

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("id", notificationId);

  if (error) return json(400, { error: "notification_mark_failed", detail: error.message });

  return json(200, { ok: true });
}
