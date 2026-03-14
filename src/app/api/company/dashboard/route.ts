import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  computeCompanyKpiFallback,
  mergeCompanyKpis,
} from "@/lib/company-dashboard-kpis";
import {
  buildCompanyProfileCompletionModel,
  resolveCompanyDisplayName,
} from "@/lib/company/company-profile";

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
      .select("name,legal_name,trade_name")
      .eq("id", companyId)
      .maybeSingle();
    const companyName = resolveCompanyDisplayName(companyData, "");
    if (companyName) return companyName;
  } catch {}

  try {
    const { data: profileData } = await supabase
      .from("company_profiles")
      .select("legal_name,trade_name")
      .eq("company_id", companyId)
      .maybeSingle();

    const profileName = resolveCompanyDisplayName(profileData, "");
    if (profileName) return profileName;
  } catch {}

  return null;
}

function normalizeCompanyVerificationStatus(input: unknown) {
  const value = String(input || "").toLowerCase();
  if (value === "verified_document") return "verified_document";
  if (value === "verified_paid") return "verified_paid";
  return "unverified";
}

function isDocsSchemaError(error: any) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || code === "42703" || (msg.includes("column") && msg.includes("does not exist"));
}

function requestDisplayStatus(statusRaw: unknown) {
  const value = String(statusRaw || "").toLowerCase();
  if (value === "verified") return "verified";
  if (value === "rejected" || value === "revoked") return "rejected";
  if (value === "pending_company" || value === "reviewing") return "pending";
  return "other";
}

async function resolveCompanyVerificationStatus(
  supabase: any,
  companyId: string,
  subscriptionStatusRaw: unknown
): Promise<"unverified" | "verified_document" | "verified_paid"> {
  const subscriptionStatus = String(subscriptionStatusRaw || "").toLowerCase();
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return "verified_paid";
  }

  // Verified_document is only granted by approved active company documents.
  const docsRes = await supabase
    .from("company_verification_documents")
    .select("review_status,lifecycle_status")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!docsRes.error && Array.isArray(docsRes.data)) {
    const activeDocs = docsRes.data.filter((d: any) => String(d?.lifecycle_status || "active").toLowerCase() !== "deleted");
    const hasApproved = activeDocs.some((d: any) => String(d?.review_status || "").toLowerCase() === "approved");
    if (hasApproved) return "verified_document";
    return "unverified";
  }

  const companyRes = await supabase
    .from("companies")
    .select("company_verification_status")
    .eq("id", companyId)
    .maybeSingle();

  if (!companyRes.error && companyRes.data?.company_verification_status) {
    if (!isDocsSchemaError(docsRes.error)) return "unverified";
    return normalizeCompanyVerificationStatus(companyRes.data.company_verification_status) as any;
  }

  const profileRes = await supabase
    .from("company_profiles")
    .select("company_verification_status")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!profileRes.error && profileRes.data?.company_verification_status) {
    if (!isDocsSchemaError(docsRes.error)) return "unverified";
    return normalizeCompanyVerificationStatus(profileRes.data.company_verification_status) as any;
  }

  return "unverified";
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

    const [{ data, error: rpcErr }, memberRes, subRes, requestsRes, reuseRes] = await Promise.all([
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
      supabase
        .from("verification_requests")
        .select("id,status,requested_at,created_at,resolved_at,requested_by,employment_record_id")
        .eq("company_id", activeCompanyId),
      supabase
        .from("verification_reuse_events")
        .select("id,reused_at,verification_id")
        .eq("company_id", activeCompanyId),
    ]);

    if (rpcErr) return NextResponse.json({ error: "rpc_failed", details: rpcErr.message, route_version: ROUTE_VERSION }, { status: 400 });

    if ((data as any)?.error) return NextResponse.json({ ...(data as any), route_version: ROUTE_VERSION }, { status: 400 });

    const requests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
    const reuseEvents = Array.isArray(reuseRes.data) ? reuseRes.data : [];
    const fallbackKpis = computeCompanyKpiFallback({ requests, reuseEvents });
    const kpisFromRpc = (data as any)?.kpis && typeof (data as any).kpis === "object" ? (data as any).kpis : {};
    const mergedKpis = mergeCompanyKpis(kpisFromRpc, fallbackKpis);
    const verificationActivity = requests.reduce(
      (acc: { pending: number; verified: number; rejected: number }, row: any) => {
        const bucket = requestDisplayStatus(row?.status);
        if (bucket === "pending") acc.pending += 1;
        if (bucket === "verified") acc.verified += 1;
        if (bucket === "rejected") acc.rejected += 1;
        return acc;
      },
      { pending: 0, verified: 0, rejected: 0 }
    );

    const recentBase = [...requests]
      .sort((a: any, b: any) => {
        const ta = Date.parse(String(a?.requested_at || a?.created_at || 0));
        const tb = Date.parse(String(b?.requested_at || b?.created_at || 0));
        return tb - ta;
      })
      .slice(0, 5);

    const candidateIds = Array.from(
      new Set(recentBase.map((row: any) => String(row?.requested_by || "")).filter(Boolean))
    );
    const employmentRecordIds = Array.from(
      new Set(recentBase.map((row: any) => String(row?.employment_record_id || "")).filter(Boolean))
    );

    const [candidateProfilesRes, employmentRecordsRes] = await Promise.all([
      candidateIds.length
        ? supabase.from("profiles").select("id,full_name").in("id", candidateIds)
        : Promise.resolve({ data: [], error: null } as any),
      employmentRecordIds.length
        ? supabase
            .from("employment_records")
            .select("id,position,company_name_freeform,start_date,end_date")
            .in("id", employmentRecordIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const candidateNameById = new Map(
      (Array.isArray(candidateProfilesRes.data) ? candidateProfilesRes.data : []).map((row: any) => [
        String(row.id),
        String(row.full_name || "").trim() || "Candidato",
      ])
    );
    const employmentById = new Map(
      (Array.isArray(employmentRecordsRes.data) ? employmentRecordsRes.data : []).map((row: any) => [
        String(row.id),
        row,
      ])
    );

    const { data: profileData } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("company_id", activeCompanyId)
      .maybeSingle();
    const companyName = await resolveCompanyName(supabase, activeCompanyId);
    const activeDocumentsCountRes = await supabase
      .from("company_verification_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", activeCompanyId)
      .neq("lifecycle_status", "deleted");
    const membersCountRes = await supabase
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", activeCompanyId);
    const completion = buildCompanyProfileCompletionModel({
      profile: profileData || {},
      activeDocumentsCount: activeDocumentsCountRes.error && isDocsSchemaError(activeDocumentsCountRes.error)
        ? 0
        : Number(activeDocumentsCountRes.count || 0),
      memberCount: Number(membersCountRes.count || 0),
    });

    const recentRequests = recentBase.map((row: any) => {
      const employment = employmentById.get(String(row?.employment_record_id || "")) as any;
      return {
        id: String(row?.id || ""),
        candidate_name: candidateNameById.get(String(row?.requested_by || "")) || "Candidato",
        status: requestDisplayStatus(row?.status),
        requested_at: row?.requested_at || row?.created_at || null,
        position: String(employment?.position || "").trim() || "Experiencia sin puesto",
        company_name: String(employment?.company_name_freeform || "").trim() || companyName || "Empresa",
        period_start: employment?.start_date || null,
        period_end: employment?.end_date || null,
      };
    });
    const membershipRole = memberRes?.data?.role ? String(memberRes.data.role) : null;
    const subscriptionPlan = subRes?.data?.plan ? String(subRes.data.plan) : null;
    const subscriptionStatus = subRes?.data?.status ? String(subRes.data.status) : "free";
    const currentPeriodEnd = subRes?.data?.current_period_end || null;
    const companyVerificationStatus = await resolveCompanyVerificationStatus(
      supabase,
      activeCompanyId,
      subscriptionStatus
    );

    // No debug fields: keep only what UI needs
    const payload = {
      company_id: (data as any)?.company_id || activeCompanyId,
      company_name: companyName || "Tu empresa",
      membership_role: membershipRole || "reviewer",
      plan: subscriptionPlan || "company_free",
      plan_label: normalizePlanLabel(subscriptionPlan),
      subscription_status: subscriptionStatus,
      company_verification_status: companyVerificationStatus,
      profile_completeness_score: completion.score,
      current_period_end: currentPeriodEnd,
      kpis: mergedKpis,
      verification_activity: verificationActivity,
      recent_requests: recentRequests,
      route_version: ROUTE_VERSION,
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: "unhandled_exception", details: e?.message || String(e), route_version: ROUTE_VERSION }, { status: 500 });
  }
}
