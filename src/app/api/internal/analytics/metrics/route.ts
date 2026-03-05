import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireInternalJobToken } from "@/lib/internalJobAuth";

export const runtime = "nodejs";

const ROUTE_VERSION = "internal-analytics-metrics-v2-sqlview";

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("missing_SUPABASE_URL_or_SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function num(x: any): number {
  const n = typeof x === "number" ? x : Number(x || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  const auth = requireInternalJobToken(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error, route_version: ROUTE_VERSION }, { status: auth.status });

  try {
    const supabase = adminSupabase();

    const { data: rows, error } = await supabase
      .from("analytics_metrics_rolling")
      .select("*");

    if (error) {
      return NextResponse.json({ ok: false, error: "view_query_failed", details: error.message, route_version: ROUTE_VERSION }, { status: 400 });
    }

    const byEvent: Record<string, any> = {};
    for (const r of rows || []) {
      const name = String((r as any).event_name || "");
      if (!name) continue;
      byEvent[name] = r;
    }

    const e = (name: string) => byEvent[name] || null;

    const kpis_7d = {
      signup: num(e("signup")?.events_7d),
      onboarding_completed: num(e("onboarding_completed")?.events_7d),
      verification_created: num(e("verification_created")?.events_7d),
      evidence_uploaded: num(e("evidence_uploaded")?.events_7d),
      verification_reused: num(e("verification_reused")?.events_7d),
      public_cv_viewed: num(e("public_cv_viewed")?.events_7d),
      active_users: Math.max(
        num(e("signup")?.users_7d),
        num(e("onboarding_completed")?.users_7d),
        num(e("verification_created")?.users_7d),
        num(e("evidence_uploaded")?.users_7d),
        num(e("verification_reused")?.users_7d)
      ),
      active_companies: Math.max(
        num(e("verification_reused")?.companies_7d),
        num(e("verification_created")?.companies_7d)
      ),
    };

    const kpis_30d = {
      signup: num(e("signup")?.events_30d),
      onboarding_completed: num(e("onboarding_completed")?.events_30d),
      verification_created: num(e("verification_created")?.events_30d),
      evidence_uploaded: num(e("evidence_uploaded")?.events_30d),
      verification_reused: num(e("verification_reused")?.events_30d),
      public_cv_viewed: num(e("public_cv_viewed")?.events_30d),
      active_users: Math.max(
        num(e("signup")?.users_30d),
        num(e("onboarding_completed")?.users_30d),
        num(e("verification_created")?.users_30d),
        num(e("evidence_uploaded")?.users_30d),
        num(e("verification_reused")?.users_30d)
      ),
      active_companies: Math.max(
        num(e("verification_reused")?.companies_30d),
        num(e("verification_created")?.companies_30d)
      ),
    };

    const reuse_rate_30d =
      kpis_30d.verification_created > 0
        ? Math.round((kpis_30d.verification_reused / kpis_30d.verification_created) * 1000) / 10
        : 0;

    const onboarding_rate_30d =
      kpis_30d.signup > 0
        ? Math.round((kpis_30d.onboarding_completed / kpis_30d.signup) * 1000) / 10
        : 0;

    return NextResponse.json({
      ok: true,
      route_version: ROUTE_VERSION,
      kpis_7d,
      kpis_30d,
      ratios: {
        reuse_rate_30d_pct: reuse_rate_30d,
        onboarding_completion_rate_30d_pct: onboarding_rate_30d,
      },
      source: {
        view: "public.analytics_metrics_rolling",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "server_error", details: String(e?.message || e), route_version: ROUTE_VERSION }, { status: 500 });
  }
}
