import { NextResponse } from "next/server";
import { effectivePlanDisplay, readEffectiveSubscriptionStates } from "@/lib/billing/effectiveSubscription";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
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
  lifecycle_status?: string | null;
  deleted_at?: string | null;
};

type AuthUserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
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

async function listAllAuthUsers(admin: ReturnType<typeof createServiceRoleClient>) {
  const out: AuthUserRow[] = [];
  const perPage = 200;
  let page = 1;
  let guard = 0;

  while (guard < 100) {
    guard += 1;
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { rows: [] as AuthUserRow[], error };
    }
    const users = Array.isArray(data?.users) ? data.users : [];
    for (const u of users as any[]) {
      out.push({
        id: String(u?.id || ""),
        email: u?.email ? String(u.email) : null,
        created_at: u?.created_at ? String(u.created_at) : null,
        last_sign_in_at: u?.last_sign_in_at ? String(u.last_sign_in_at) : null,
      });
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return { rows: out, error: null };
}

async function selectProfilesByIds(admin: ReturnType<typeof createServiceRoleClient>, ids: string[]) {
  if (ids.length === 0) return { rows: [] as ProfileRow[], error: null as any };
  const { data: columnRows } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "profiles");
  const columnSet = new Set((columnRows || []).map((r: any) => String(r?.column_name || "")));
  const selected = [
    "id",
    "email",
    "full_name",
    "role",
    "onboarding_completed",
    "created_at",
    "active_company_id",
    columnSet.has("lifecycle_status") ? "lifecycle_status" : null,
    columnSet.has("deleted_at") ? "deleted_at" : null,
  ]
    .filter(Boolean)
    .join(",");
  const chunkSize = 500;
  const all: ProfileRow[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await admin
      .from("profiles")
      .select(selected)
      .in("id", chunk);
    if (error) return { rows: [] as ProfileRow[], error };
    if (Array.isArray(data)) all.push(...(data as unknown as ProfileRow[]));
  }
  return { rows: all, error: null as any };
}

function ts(raw: unknown) {
  const value = String(raw || "");
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
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
      return json(401, { route_version: "owner-users-v7", error: "unauthorized" });
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userRes.user.id)
      .maybeSingle();

    if (profErr || !profile) {
      return json(403, { route_version: "owner-users-v7", error: "profile_not_found" });
    }
    if (!(["owner", "admin"].includes(String(profile.role || "").toLowerCase()))) {
      return json(403, { route_version: "owner-users-v7", error: "forbidden" });
    }

    const admin = createServiceRoleClient();

    const { rows: authUsers, error: authListError } = await listAllAuthUsers(admin);
    if (authListError) {
      return json(400, { route_version: "owner-users-v7", error: "auth_users_query_failed", details: authListError.message });
    }

    const authUserIds = authUsers.map((u) => String(u.id || "")).filter((id) => isUuid(id));
    const { rows: profileRows, error: profilesError } = await selectProfilesByIds(admin, authUserIds);
    if (profilesError) {
      return json(400, { route_version: "owner-users-v7", error: "profiles_query_failed", details: profilesError.message });
    }

    const profileById = new Map(profileRows.map((row) => [String(row.id), row]));
    const mergedRows: ProfileRow[] = authUsers.map((authRow) => {
      const id = String(authRow.id || "");
      const profileRow = profileById.get(id) || null;
      return {
        id,
        email: profileRow?.email || authRow.email || null,
        full_name: profileRow?.full_name || null,
        role: profileRow?.role || null,
        onboarding_completed: profileRow?.onboarding_completed ?? null,
        created_at: profileRow?.created_at || authRow.created_at || null,
        active_company_id: profileRow?.active_company_id || null,
        lifecycle_status: profileRow?.lifecycle_status ? String(profileRow.lifecycle_status) : "active",
        deleted_at: profileRow?.deleted_at ? String(profileRow.deleted_at) : null,
      };
    });

    let companyMatchIds = new Set<string>();
    if (q) {
      const { data: companyMatches } = await admin
        .from("companies")
        .select("id")
        .or(`name.ilike.%${q}%,trade_name.ilike.%${q}%,legal_name.ilike.%${q}%`)
        .limit(100);

      companyMatchIds = new Set(
        (companyMatches || [])
          .map((c: any) => String(c?.id || ""))
          .filter((id: string) => isUuid(id))
      );
    }

    const role = normalizeRole(roleFilter);
    const qLower = q.toLowerCase();
    const filteredRows = mergedRows.filter((row) => {
      if (role && normalizeRole(row.role) !== role) return false;

      if (quickFilter === "onboarding_incomplete" && row.onboarding_completed !== false) return false;
      if (quickFilter === "with_company" && !row.active_company_id) return false;
      if (quickFilter === "without_company" && !!row.active_company_id) return false;
      if (quickFilter === "deleted" && String(row.lifecycle_status || "active").toLowerCase() !== "deleted") return false;
      if (quickFilter === "active_only" && String(row.lifecycle_status || "active").toLowerCase() === "deleted") return false;

      if (!qLower) return true;
      const haystack = [
        row.email || "",
        row.full_name || "",
        row.id || "",
        row.role || "",
        row.active_company_id || "",
        row.lifecycle_status || "",
      ]
        .join(" ")
        .toLowerCase();
      if (haystack.includes(qLower)) return true;
      if (row.active_company_id && companyMatchIds.has(String(row.active_company_id))) return true;
      return false;
    });

    filteredRows.sort((a, b) => ts(b.created_at) - ts(a.created_at));
    const total = filteredRows.length;
    const rows = filteredRows.slice(offset, offset + limit);

    const profileRoleRows = profileRows;
    const summary = {
      candidates: profileRoleRows.filter((r: any) => String(r.role || "").toLowerCase() === "candidate").length,
      companies: profileRoleRows.filter((r: any) => String(r.role || "").toLowerCase() === "company").length,
      owners: profileRoleRows.filter((r: any) => {
        const role = String(r.role || "").toLowerCase();
        return role === "owner" || role === "admin";
      }).length,
      onboarding_incomplete: profileRoleRows.filter((r: any) => Boolean(r.onboarding_completed) === false).length,
      with_active_company: profileRoleRows.filter((r: any) => Boolean(r.active_company_id)).length,
      archived: profileRoleRows.filter((r: any) => String((r as any).lifecycle_status || "").toLowerCase() === "deleted").length,
      without_profile: authUsers.length - profileRows.length,
      total_auth_users: authUsers.length,
    };
    const userIds = rows.map((r) => String(r.id)).filter(Boolean);
    const companyIds = Array.from(new Set(rows.map((r) => String(r.active_company_id || "")).filter((id) => isUuid(id))));

    const [
      employmentRes,
      verificationRes,
      evidenceRes,
      companiesRes,
      candidateProfilesRes,
    ] = await Promise.all([
      userIds.length
        ? admin.from("employment_records").select("candidate_id,created_at").in("candidate_id", userIds)
        : Promise.resolve({ data: [] as any[] } as any),
      userIds.length
        ? admin
            .from("verification_requests")
            .select("requested_by,status,created_at,requested_at,resolved_at")
            .in("requested_by", userIds)
        : Promise.resolve({ data: [] as any[] } as any),
      userIds.length
        ? admin.from("evidences").select("uploaded_by,created_at").in("uploaded_by", userIds)
        : Promise.resolve({ data: [] as any[] } as any),
      companyIds.length
        ? admin.from("companies").select("id,name,trade_name,legal_name").in("id", companyIds)
        : Promise.resolve({ data: [] as any[] } as any),
      userIds.length
        ? admin.from("candidate_profiles").select("user_id,trust_score").in("user_id", userIds)
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
      companyNameById.set(String((c as any)?.id || ""), resolveCompanyDisplayName(c as any, "Tu empresa"));
    }

    const trustByUser = new Map<string, number>();
    for (const cp of Array.isArray(candidateProfilesRes.data) ? candidateProfilesRes.data : []) {
      const uid = String((cp as any)?.user_id || "");
      if (!uid) continue;
      trustByUser.set(uid, Number((cp as any)?.trust_score || 0));
    }

    const effectiveSubscriptionsByUser = await readEffectiveSubscriptionStates(admin, userIds);

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
      const effectiveSubscription = effectiveSubscriptionsByUser.get(id) || null;
      const effectivePlan = effectivePlanDisplay(
        effectiveSubscription || {
          plan: "free",
          status: "free",
          current_period_end: null,
          metadata: {},
          source: "none",
          subscription: null,
          override: null,
        }
      );
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
        lifecycle_status: String((row as any).lifecycle_status || "active"),
        deleted_at: (row as any).deleted_at ? String((row as any).deleted_at) : null,
        experiences_count: experiencesByUser.get(id) || 0,
        verifications_count: verificationsByUser.get(id) || 0,
        verifications_verified_count: verifiedByUser.get(id) || 0,
        evidences_count: evidencesByUser.get(id) || 0,
        plan: effectiveSubscription?.plan ? String(effectiveSubscription.plan) : "free",
        plan_label: effectivePlan.planLabel,
        plan_source: effectiveSubscription?.source || "none",
        subscription_status: effectiveSubscription?.status ? String(effectiveSubscription.status) : "free",
        subscription_current_period_end: effectiveSubscription?.current_period_end ? String(effectiveSubscription.current_period_end) : null,
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
          total: total ?? null,
        },
      });
    } catch {}

    return json(200, {
      route_version: "owner-users-v7",
      q,
      role_filter: roleFilter,
      quick_filter: quickFilter,
      limit,
      offset,
      total: total ?? null,
      users,
      summary,
    });
  } catch (e: any) {
    return json(500, {
      route_version: "owner-users-v7",
      error: "internal_error",
      details: e?.message || String(e),
    });
  }
}
