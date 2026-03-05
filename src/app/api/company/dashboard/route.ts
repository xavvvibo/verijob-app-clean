import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const ROUTE_VERSION = "company-dashboard-kpis-v2-2026-03-05";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr) return NextResponse.json({ error: "auth_getUser_failed", details: uErr.message, route_version: ROUTE_VERSION }, { status: 400 });
    if (!user) return NextResponse.json({ error: "unauthorized", route_version: ROUTE_VERSION }, { status: 401 });

    // Self-heal active_company_id if missing (best-effort)
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id,email,active_company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr) return NextResponse.json({ error: "profiles_read_failed", details: pErr.message, route_version: ROUTE_VERSION }, { status: 400 });

    let activeCompanyId = (prof as any)?.active_company_id as string | null;

    if (!activeCompanyId) {
      const { data: mem, error: mErr } = await supabase
        .from("company_members")
        .select("company_id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (mErr) {
        return NextResponse.json({
          error: "no_active_company",
          details: "company_members_read_failed",
          route_version: ROUTE_VERSION,
          debug: { user_id: user.id, company_members_error: mErr.message }
        }, { status: 400 });
      }

      const inferred = mem && mem[0]?.company_id ? String(mem[0].company_id) : null;

      if (inferred) {
        const { error: upErr } = await supabase
          .from("profiles")
          .update({ active_company_id: inferred })
          .eq("id", user.id);

        if (upErr) {
          return NextResponse.json({
            error: "no_active_company",
            details: "profiles_update_active_company_failed",
            route_version: ROUTE_VERSION,
            debug: { user_id: user.id, inferred_company_id: inferred, update_error: upErr.message }
          }, { status: 400 });
        }

        activeCompanyId = inferred;
      }
    }

    if (!activeCompanyId) {
      const { count: memCount } = await supabase
        .from("company_members")
        .select("company_id", { count: "exact", head: true })
        .eq("user_id", user.id);

      return NextResponse.json({
        error: "no_active_company",
        route_version: ROUTE_VERSION,
        debug: { user_id: user.id, company_members_count: memCount || 0 }
      }, { status: 400 });
    }

    // IMPORTANT: call v2 (the fixed function)
    const { data, error: rpcErr } = await supabase.rpc("company_dashboard_kpis_v2");
    if (rpcErr) return NextResponse.json({ error: "rpc_failed", details: rpcErr.message, route_version: ROUTE_VERSION }, { status: 400 });

    if ((data as any)?.error) {
      return NextResponse.json({ ...(data as any), route_version: ROUTE_VERSION }, { status: 400 });
    }

    return NextResponse.json({ ...(data as any), route_version: ROUTE_VERSION });
  } catch (e: any) {
    return NextResponse.json({ error: "unhandled_exception", details: e?.message || String(e), route_version: ROUTE_VERSION }, { status: 500 });
  }
}
