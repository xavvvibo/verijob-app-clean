import { createClient } from "@supabase/supabase-js";

type TrackArgs = {
  event_name: string;
  user_id?: string | null;
  company_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, any>;
};

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function getServiceKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    ""
  );
}

/**
 * Best-effort admin event tracking (never throws).
 * Uses service_role to bypass RLS safely on platform_events.
 */
export async function trackEventAdmin(args: TrackArgs): Promise<void> {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceKey();
    if (!supabaseUrl || !serviceKey) return;

    const supabase: any = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload = {
      event_name: String(args.event_name || "").slice(0, 80),
      user_id: args.user_id ?? null,
      company_id: args.company_id ?? null,
      entity_type: args.entity_type ? String(args.entity_type).slice(0, 60) : null,
      entity_id: args.entity_id ?? null,
      metadata: args.metadata && typeof args.metadata === "object" ? args.metadata : {},
    };

    // Insert only if event_name exists
    if (!payload.event_name) return;

    await supabase.from("platform_events").insert(payload);
  } catch {
    // swallow
  }
}
