import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireInternalJobToken } from "@/lib/internalJobAuth";

export const runtime = "nodejs";

const ROUTE_VERSION = "internal-analytics-event-v1";

const ALLOWED_EVENTS = new Set([
  "signup",
  "onboarding_completed",
  "verification_created",
  "evidence_uploaded",
  "verification_shared",
  "reuse_imported",
  "verification_reused",
  "subscription_started",
  "subscription_cancelled",
  "public_cv_viewed",
]);

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("missing_SUPABASE_URL_or_SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const auth = requireInternalJobToken(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error, route_version: ROUTE_VERSION }, { status: auth.status });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json", route_version: ROUTE_VERSION }, { status: 400 });
  }

  const event_name = String(body?.event_name || "").trim();
  if (!event_name) return NextResponse.json({ ok: false, error: "missing_event_name", route_version: ROUTE_VERSION }, { status: 400 });
  if (!ALLOWED_EVENTS.has(event_name)) {
    return NextResponse.json({ ok: false, error: "event_name_not_allowed", event_name, route_version: ROUTE_VERSION }, { status: 400 });
  }

  const user_id = body?.user_id ?? null;
  const company_id = body?.company_id ?? null;

  const entity_type = body?.entity_type ? String(body.entity_type) : null;
  const entity_id = body?.entity_id ?? null;

  const metadata = (body?.metadata && typeof body.metadata === "object") ? body.metadata : {};

  try {
    const supabase = adminSupabase();
    const { data, error } = await supabase
      .from("platform_events")
      .insert({
        event_name,
        user_id,
        company_id,
        entity_type,
        entity_id,
        metadata,
      })
      .select("id,event_name,user_id,company_id,entity_type,entity_id,created_at")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: "db_insert_failed", details: error.message, route_version: ROUTE_VERSION }, { status: 400 });
    }

    return NextResponse.json({ ok: true, event: data, route_version: ROUTE_VERSION });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "server_error", details: String(e?.message || e), route_version: ROUTE_VERSION }, { status: 500 });
  }
}
