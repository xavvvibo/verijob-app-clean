import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
  active_company_id: string | null;
};

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normalizeRole(v: string | null) {
  const role = String(v || "").toLowerCase();
  if (role === "candidate" || role === "company" || role === "owner" || role === "admin") return role;
  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const roleFilter = String(url.searchParams.get("role") || "all").trim().toLowerCase();
    const quickFilter = String(url.searchParams.get("quick") || "all").trim().toLowerCase();
    const limitRaw = url.searchParams.get("limit") || "50";
    const offsetRaw = url.searchParams.get("offset") || "0";
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetRaw, 10) || 0, 0);

    const supabase = await createRouteHandlerClient();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return json(401, { route_version: "owner-users-v6", error: "unauthorized" });
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userRes.user.id)
      .maybeSingle();

    if (profErr || !profile) {
      return json(403, { route_version: "owner-users-v6", error: "profile_not_found" });
    }
    if (!(["owner", "admin"].includes(String(profile.role || "").toLowerCase()))) {
      return json(403, { route_version: "owner-users-v6", error: "forbidden" });
    }

    let query = supabase
      .from("profiles")
      .select("id, email, full_name, role, onboarding_completed, created_at, active_company_id", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const role = normalizeRole(roleFilter);
    if (role) {
      query = query.eq("role", role);
    }

    if (quickFilter === "onboarding_incomplete") {
      query = query.eq("onboarding_completed", false);
    } else if (quickFilter === "with_company") {
      query = query.not("active_company_id", "is", null);
    } else if (quickFilter === "without_company") {
      query = query.is("active_company_id", null);
    }

    if (q) {
      const orParts = [
        `email.ilike.%${q}%`,
        `full_name.ilike.%${q}%`,
        `id.ilike.%${q}%`,
        `role.ilike.%${q}%`,
        `active_company_id.ilike.%${q}%`,
      ];

      const { data: companyMatches } = await supabase
        .from("companies")
        .select("id")
        .ilike("name", `%${q}%`)
        .limit(50);

      const companyIds = (companyMatches || [])
        .map((c: any) => String(c?.id || ""))
        .filter((id: string) => isUuid(id));
      if (companyIds.length > 0) {
        orParts.push(`active_company_id.in.(${companyIds.join(",")})`);
      }

      query = query.or(orParts.join(","));
    }

    const { data, error, count } = await query;

    if (error) {
      return json(400, { route_version: "owner-users-v6", error: "profiles_query_failed", details: error.message });
    }

    const rows: ProfileRow[] = Array.isArray(data) ? (data as ProfileRow[]) : [];
    const { data: profileRoles } = await supabase.from("profiles").select("role,onboarding_completed,active_company_id");
    const profileRoleRows = Array.isArray(profileRoles) ? profileRoles : [];
    const summary = {
      candidates: profileRoleRows.filter((r: any) => String(r.role || "").toLowerCase() === "candidate").length,
      companies: profileRoleRows.filter((r: any) => String(r.role || "").toLowerCase() === "company").length,
      owners: profileRoleRows.filter((r: any) => {
        const role = String(r.role || "").toLowerCase();
        return role === "owner" || role === "admin";
      }).length,
      onboarding_incomplete: profileRoleRows.filter((r: any) => Boolean(r.onboarding_completed) === false).length,
      with_active_company: profileRoleRows.filter((r: any) => Boolean(r.active_company_id)).length,
    };
    const userIds = rows.map((r) => String(r.id)).filter(Boolean);
    const companyIds = Array.from(new Set(rows.map((r) => String(r.active_company_id || "")).filter((id) => isUuid(id))));

    const [
      employmentRes,
      verificationRes,
      evidenceRes,
      subscriptionsRes,
      companiesRes,
      candidateProfilesRes,
    ] = await Promise.all([
      userIds.length
        ? supabase.from("employment_records").select("candidate_id,created_at").in("candidate_id", userIds)
        : Promise.resolve({ data: [] as any[] } as any),
      userIds.length
        ? supabase
            .from("verification_requests")
            .select("requested_by,status,created_at,requested_at,resolved_at")
            .in("requested_by", userIds)
        : Promise.resolve({ data: [] as any[] } as any),
      userIds.length
        ? supabase.from("evidences").select("uploaded_by,created_at").in("uploaded_by", userIds)
        : Promise.resolve({ data: [] as any[] } as any),
      userIds.length
        ? supabase
            .from("subscriptions")
            .select("user_id,plan,status,current_period_end,created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] } as any),
      companyIds.length
        ? supabase.from("companies").select("id,name").in("id", companyIds)
        : Promise.resolve({ data: [] as any[] } as any),
      userIds.length
        ? supabase.from("candidate_profiles").select("user_id,trust_score").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] } as any),
    ]);

    const countBy = (rowsAny: any[], keyName: string) => {
      const map = new Map<string, number>();
      for (const row of rowsAny) {
        const key = String((row as any)?.[keyName] || "");
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + 1);
      }
      return map;
    };

    const experiencesByUser = countBy(Array.isArray(employmentRes.data) ? employmentRes.data : [], "candidate_id");
    const evidencesByUser = countBy(Array.isArray(evidenceRes.data) ? evidenceRes.data : [], "uploaded_by");

    const verificationRows = Array.isArray(verificationRes.data) ? verificationRes.data : [];
    const verificationsByUser = countBy(verificationRows, "requested_by");
    const verifiedByUser = new Map<string, number>();
    for (const row of verificationRows) {
      const key = String((row as any)?.requested_by || "");
      if (!key) continue;
      const st = String((row as any)?.status || "").toLowerCase();
      if (st.includes("verified")) {
        verifiedByUser.set(key, (verifiedByUser.get(key) || 0) + 1);
      }
    }

    const companyNameById = new Map<string, string>();
    for (const c of Array.isArray(companiesRes.data) ? companiesRes.data : []) {
      companyNameById.set(String((c as any)?.id || ""), String((c as any)?.name || ""));
    }

    const trustByUser = new Map<string, number>();
    for (const cp of Array.isArray(candidateProfilesRes.data) ? candidateProfilesRes.data : []) {
      const uid = String((cp as any)?.user_id || "");
      if (!uid) continue;
      trustByUser.set(uid, Number((cp as any)?.trust_score || 0));
    }

    const subscriptionsByUser = new Map<string, any>();
    for (const sub of Array.isArray(subscriptionsRes.data) ? subscriptionsRes.data : []) {
      const uid = String((sub as any)?.user_id || "");
      if (!uid || subscriptionsByUser.has(uid)) continue;
      subscriptionsByUser.set(uid, sub);
    }

    const lastActivityByUser = new Map<string, string>();
    const registerActivity = (uid: string, rawDate: unknown) => {
      const dateStr = String(rawDate || "").trim();
      if (!uid || !dateStr) return;
      const current = lastActivityByUser.get(uid);
      if (!current || new Date(dateStr).getTime() > new Date(current).getTime()) {
        lastActivityByUser.set(uid, dateStr);
      }
    };

    for (const row of rows) registerActivity(String(row.id), row.created_at);
    for (const row of Array.isArray(employmentRes.data) ? employmentRes.data : []) {
      registerActivity(String((row as any)?.candidate_id || ""), (row as any)?.created_at);
    }
    for (const row of verificationRows) {
      const uid = String((row as any)?.requested_by || "");
      registerActivity(uid, (row as any)?.resolved_at || (row as any)?.requested_at || (row as any)?.created_at);
    }
    for (const row of Array.isArray(evidenceRes.data) ? evidenceRes.data : []) {
      registerActivity(String((row as any)?.uploaded_by || ""), (row as any)?.created_at);
    }

    const users = rows.map((row) => {
      const id = String(row.id);
      const sub = subscriptionsByUser.get(id) || null;
      const companyId = String(row.active_company_id || "") || null;
      return {
        id,
        email: row.email || null,
        full_name: row.full_name || null,
        role: row.role || null,
        onboarding_completed: row.onboarding_completed,
        created_at: row.created_at || null,
        active_company_id: companyId,
        active_company_name: companyId ? companyNameById.get(companyId) || null : null,
        experiences_count: experiencesByUser.get(id) || 0,
        verifications_count: verificationsByUser.get(id) || 0,
        verifications_verified_count: verifiedByUser.get(id) || 0,
        evidences_count: evidencesByUser.get(id) || 0,
        plan: sub?.plan ? String(sub.plan) : null,
        subscription_status: sub?.status ? String(sub.status) : null,
        subscription_current_period_end: sub?.current_period_end ? String(sub.current_period_end) : null,
        trust_score: trustByUser.has(id) ? Number(trustByUser.get(id) || 0) : null,
        last_activity_at: lastActivityByUser.get(id) || null,
      };
    });

    try {
      await trackEventAdmin({
        event_name: "owner_users_viewed",
        user_id: userRes.user.id,
        metadata: {
          source: "api_owner_users",
          role: "owner",
          q: q || null,
          role_filter: roleFilter,
          quick_filter: quickFilter,
          limit,
          offset,
          returned: users.length,
          total: count ?? null,
        },
      });
    } catch {}

    return json(200, {
      route_version: "owner-users-v6",
      q,
      role_filter: roleFilter,
      quick_filter: quickFilter,
      limit,
      offset,
      total: count ?? null,
      users,
      summary,
    });
  } catch (e: any) {
    return json(500, {
      route_version: "owner-users-v6",
      error: "internal_error",
      details: e?.message || String(e),
    });
  }
}
