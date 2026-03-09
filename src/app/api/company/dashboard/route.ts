import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const ROUTE_VERSION = "company-dashboard-kpis-v2-clean-2026-03-05";

function normalizePlanLabel(planRaw: unknown) {
  const plan = String(planRaw || "").toLowerCase();
  if (plan.includes("company_team")) return "Team";
  if (plan.includes("company_hiring")) return "Hiring";
  if (plan.includes("company_access")) return "Access";
  if (plan.includes("company_enterprise")) return "Enterprise";
  return "Free";
}

async function resolveCompanyName(supabase: any, companyId: string): Promise<string | null> {
  try {
    const { data: companyData } = await supabase
      .from("companies")
      .select("name,legal_name,trade_name,display_name")
      .eq("id", companyId)
      .maybeSingle();

    const companyName =
      companyData?.name ||
      companyData?.trade_name ||
      companyData?.display_name ||
      companyData?.legal_name ||
      null;

    if (companyName) return String(companyName);
  } catch {}

  try {
    const { data: profileData } = await supabase
      .from("company_profiles")
      .select("name,legal_name,display_name,trade_name")
      .eq("company_id", companyId)
      .maybeSingle();

    const profileName =
      profileData?.name ||
      profileData?.trade_name ||
      profileData?.display_name ||
      profileData?.legal_name ||
      null;

    if (profileName) return String(profileName);
  } catch {}

  return null;
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr) return NextResponse.json({ error: "auth_getUser_failed", details: uErr.message, route_version: ROUTE_VERSION }, { status: 400 });
    if (!user) return NextResponse.json({ error: "unauthorized", route_version: ROUTE_VERSION }, { status: 401 });

    // self-heal active_company_id if missing (best-effort)
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("active_company_id")
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
        return NextResponse.json({ error: "no_active_company", details: "company_members_read_failed", route_version: ROUTE_VERSION }, { status: 400 });
      }

      const inferred = mem && mem[0]?.company_id ? String(mem[0].company_id) : null;

      if (inferred) {
        const { error: upErr } = await supabase
          .from("profiles")
          .update({ active_company_id: inferred })
          .eq("id", user.id);

        if (upErr) {
          return NextResponse.json({ error: "no_active_company", details: "profiles_update_active_company_failed", route_version: ROUTE_VERSION }, { status: 400 });
        }

        activeCompanyId = inferred;
      }
    }

    if (!activeCompanyId) return NextResponse.json({ error: "no_active_company", route_version: ROUTE_VERSION }, { status: 400 });

    const [{ data, error: rpcErr }, memberRes, subRes] = await Promise.all([
      supabase.rpc("company_dashboard_kpis_v2"),
      supabase
        .from("company_members")
        .select("role")
        .eq("company_id", activeCompanyId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan,status,current_period_end")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (rpcErr) return NextResponse.json({ error: "rpc_failed", details: rpcErr.message, route_version: ROUTE_VERSION }, { status: 400 });

    if ((data as any)?.error) return NextResponse.json({ ...(data as any), route_version: ROUTE_VERSION }, { status: 400 });

    const companyName = await resolveCompanyName(supabase, activeCompanyId);
    const membershipRole = memberRes?.data?.role ? String(memberRes.data.role) : null;
    const subscriptionPlan = subRes?.data?.plan ? String(subRes.data.plan) : null;
    const subscriptionStatus = subRes?.data?.status ? String(subRes.data.status) : "free";
    const currentPeriodEnd = subRes?.data?.current_period_end || null;

    // No debug fields: keep only what UI needs
    const payload = {
      company_id: (data as any)?.company_id || activeCompanyId,
      company_name: companyName || "Tu empresa",
      membership_role: membershipRole || "reviewer",
      plan: subscriptionPlan || "company_free",
      plan_label: normalizePlanLabel(subscriptionPlan),
      subscription_status: subscriptionStatus,
      current_period_end: currentPeriodEnd,
      kpis: (data as any)?.kpis || null,
      route_version: ROUTE_VERSION,
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: "unhandled_exception", details: e?.message || String(e), route_version: ROUTE_VERSION }, { status: 500 });
  }
}
