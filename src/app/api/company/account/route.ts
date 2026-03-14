import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { buildIdentityRecord } from "@/lib/security/identity";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";

export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, any>) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function getTableColumns(admin: any, tableName: string) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);
  if (error || !Array.isArray(data)) return new Set<string>();
  return new Set(data.map((row: any) => String(row?.column_name || "")));
}

async function resolveContext() {
  const supabase = await createRouteHandlerClient();
  const admin = createServiceRoleClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) return { error: json(400, { error: "auth_getUser_failed", details: userErr.message }) };
  if (!user) return { error: json(401, { error: "unauthorized" }) };

  const [profileColumns, companyColumns] = await Promise.all([
    getTableColumns(admin, "profiles"),
    getTableColumns(admin, "companies"),
  ]);

  const profileSelect = [
    "id",
    "role",
    "active_company_id",
    profileColumns.has("lifecycle_status") ? "lifecycle_status" : null,
    profileColumns.has("deleted_at") ? "deleted_at" : null,
    profileColumns.has("deletion_requested_at") ? "deletion_requested_at" : null,
    profileColumns.has("deletion_mode") ? "deletion_mode" : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select(profileSelect)
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) return { error: json(400, { error: "profiles_read_failed", details: profileErr.message }) };
  if (String((profile as any)?.role || "").toLowerCase() !== "company") {
    return { error: json(403, { error: "company_role_required" }) };
  }

  let companyId = String((profile as any)?.active_company_id || "").trim();
  if (!companyId) {
    const { data: membershipFallback } = await admin
      .from("company_members")
      .select("company_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    companyId = String((membershipFallback as any)?.company_id || "").trim();
  }
  if (!companyId) return { error: json(400, { error: "no_active_company" }) };

  const { data: membership, error: membershipErr } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipErr) return { error: json(400, { error: "company_membership_read_failed", details: membershipErr.message }) };
  if (!membership) return { error: json(403, { error: "company_membership_required" }) };

  const companySelect = [
    "id",
    "name",
    companyColumns.has("trade_name") ? "trade_name" : null,
    companyColumns.has("legal_name") ? "legal_name" : null,
    companyColumns.has("lifecycle_status") ? "lifecycle_status" : null,
    companyColumns.has("deletion_requested_at") ? "deletion_requested_at" : null,
    companyColumns.has("deleted_at") ? "deleted_at" : null,
    companyColumns.has("identity_type") ? "identity_type" : null,
    companyColumns.has("identity_masked") ? "identity_masked" : null,
    companyColumns.has("identity_hash") ? "identity_hash" : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data: company, error: companyErr } = await admin
    .from("companies")
    .select(companySelect)
    .eq("id", companyId)
    .maybeSingle();
  if (companyErr) return { error: json(400, { error: "companies_read_failed", details: companyErr.message }) };

  return {
    user,
    admin,
    profileColumns,
    companyColumns,
    profile: profile || {},
    membershipRole: String((membership as any)?.role || "reviewer").toLowerCase(),
    company: company || { id: companyId },
  };
}

export async function GET() {
  const ctx = await resolveContext();
  if ((ctx as any).error) return (ctx as any).error;
  const { profile, membershipRole, company } = ctx as any;

  return json(200, {
    account: {
      user: {
        lifecycle_status: String((profile as any)?.lifecycle_status || "active"),
        deleted_at: (profile as any)?.deleted_at || null,
        deletion_requested_at: (profile as any)?.deletion_requested_at || null,
        deletion_mode: (profile as any)?.deletion_mode || null,
      },
      company: {
        id: String((company as any)?.id || ""),
        display_name: resolveCompanyDisplayName(company, "Tu empresa"),
        lifecycle_status: String((company as any)?.lifecycle_status || "active"),
        deleted_at: (company as any)?.deleted_at || null,
        deletion_requested_at: (company as any)?.deletion_requested_at || null,
        identity_type: (company as any)?.identity_type || null,
        identity_masked: (company as any)?.identity_masked || null,
        has_identity: Boolean((company as any)?.identity_hash),
      },
      membership_role: membershipRole,
      can_manage_company: membershipRole === "admin",
    },
  });
}

export async function POST(request: Request) {
  const ctx = await resolveContext();
  if ((ctx as any).error) return (ctx as any).error;
  const { user, admin, profileColumns, companyColumns, profile, membershipRole, company } = ctx as any;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const companyId = String((company as any)?.id || "");

  if (action === "update_company_identity") {
    if (membershipRole !== "admin") return json(403, { error: "admin_role_required" });
    try {
      const identity = buildIdentityRecord({ type: body?.identity_type, value: body?.identity_value });
      if (!identity.identityType || !identity.identityMasked || !identity.identityHash) {
        return json(400, { error: "invalid_identity", user_message: "Introduce un NIF o pasaporte valido para asociarlo a la empresa." });
      }
      const patch: Record<string, any> = {};
      if (companyColumns.has("identity_type")) patch.identity_type = identity.identityType;
      if (companyColumns.has("identity_masked")) patch.identity_masked = identity.identityMasked;
      if (companyColumns.has("identity_hash")) patch.identity_hash = identity.identityHash;
      const { error } = await admin.from("companies").update(patch).eq("id", companyId);
      if (error) return json(400, { error: "company_identity_update_failed", details: error.message });
      return json(200, {
        ok: true,
        account: {
          company: {
            identity_type: identity.identityType,
            identity_masked: identity.identityMasked,
            has_identity: true,
          },
        },
      });
    } catch (error: any) {
      return json(500, { error: "identity_hash_failed", details: String(error?.message || error) });
    }
  }

  if (action === "clear_company_identity") {
    if (membershipRole !== "admin") return json(403, { error: "admin_role_required" });
    const patch: Record<string, any> = {};
    if (companyColumns.has("identity_type")) patch.identity_type = null;
    if (companyColumns.has("identity_masked")) patch.identity_masked = null;
    if (companyColumns.has("identity_hash")) patch.identity_hash = null;
    const { error } = await admin.from("companies").update(patch).eq("id", companyId);
    if (error) return json(400, { error: "company_identity_clear_failed", details: error.message });
    return json(200, { ok: true, account: { company: { identity_type: null, identity_masked: null, has_identity: false } } });
  }

  if (action === "disable_user") {
    const patch: Record<string, any> = {};
    if (profileColumns.has("lifecycle_status")) patch.lifecycle_status = "disabled";
    if (profileColumns.has("deletion_requested_at")) patch.deletion_requested_at = nowIso;
    if (profileColumns.has("deletion_mode")) patch.deletion_mode = "temporary";
    if (profileColumns.has("deleted_at")) patch.deleted_at = null;
    const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
    if (error) return json(400, { error: "user_disable_failed", details: error.message });
    return json(200, {
      ok: true,
      account: { user: { lifecycle_status: "disabled", deletion_mode: "temporary", deletion_requested_at: nowIso } },
      user_message: "Tu usuario empresa ha quedado desactivado temporalmente. La empresa y sus verificaciones historicas se conservan.",
    });
  }

  if (action === "reactivate_user") {
    const patch: Record<string, any> = {};
    if (profileColumns.has("lifecycle_status")) patch.lifecycle_status = "active";
    if (profileColumns.has("deletion_requested_at")) patch.deletion_requested_at = null;
    if (profileColumns.has("deletion_mode")) patch.deletion_mode = null;
    if (profileColumns.has("deleted_at")) patch.deleted_at = null;
    const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
    if (error) return json(400, { error: "user_reactivate_failed", details: error.message });
    return json(200, { ok: true, account: { user: { lifecycle_status: "active" } }, user_message: "Tu usuario empresa vuelve a estar activo." });
  }

  if (action === "delete_user") {
    const { count: membersCount } = await admin
      .from("company_members")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);
    if ((membersCount || 0) <= 1 && String((company as any)?.lifecycle_status || "active").toLowerCase() === "active") {
      return json(409, {
        error: "last_member_company_still_active",
        user_message: "No puedes eliminar tu usuario mientras seas la unica persona con acceso a una empresa activa. Cierra la empresa o incorpora otro admin primero.",
      });
    }

    const patch: Record<string, any> = { active_company_id: null };
    if (profileColumns.has("lifecycle_status")) patch.lifecycle_status = "deleted";
    if (profileColumns.has("deletion_requested_at")) patch.deletion_requested_at = nowIso;
    if (profileColumns.has("deletion_mode")) patch.deletion_mode = "permanent";
    if (profileColumns.has("deleted_at")) patch.deleted_at = nowIso;
    const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
    if (error) return json(400, { error: "user_delete_failed", details: error.message });

    await admin.from("company_members").delete().eq("company_id", companyId).eq("user_id", user.id);
    try {
      await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
    } catch {}

    return json(200, {
      ok: true,
      account: { user: { lifecycle_status: "deleted", deleted_at: nowIso } },
      user_message: "Tu usuario empresa ha quedado eliminado. La empresa y las verificaciones historicas emitidas se conservan.",
    });
  }

  if (action === "disable_company") {
    if (membershipRole !== "admin") return json(403, { error: "admin_role_required" });
    const patch: Record<string, any> = {};
    if (companyColumns.has("lifecycle_status")) patch.lifecycle_status = "disabled";
    if (companyColumns.has("deletion_requested_at")) patch.deletion_requested_at = nowIso;
    if (companyColumns.has("deleted_at")) patch.deleted_at = null;
    const { error } = await admin.from("companies").update(patch).eq("id", companyId);
    if (error) return json(400, { error: "company_disable_failed", details: error.message });
    return json(200, {
      ok: true,
      account: { company: { lifecycle_status: "disabled", deletion_requested_at: nowIso } },
      user_message: "La empresa ha quedado desactivada. No se eliminan las verificaciones historicas ya emitidas.",
    });
  }

  if (action === "reactivate_company") {
    if (membershipRole !== "admin") return json(403, { error: "admin_role_required" });
    const patch: Record<string, any> = {};
    if (companyColumns.has("lifecycle_status")) patch.lifecycle_status = "active";
    if (companyColumns.has("deletion_requested_at")) patch.deletion_requested_at = null;
    if (companyColumns.has("deleted_at")) patch.deleted_at = null;
    const { error } = await admin.from("companies").update(patch).eq("id", companyId);
    if (error) return json(400, { error: "company_reactivate_failed", details: error.message });
    return json(200, { ok: true, account: { company: { lifecycle_status: "active" } }, user_message: "La empresa vuelve a estar activa." });
  }

  if (action === "close_company") {
    if (membershipRole !== "admin") return json(403, { error: "admin_role_required" });
    const patch: Record<string, any> = {};
    if (companyColumns.has("lifecycle_status")) patch.lifecycle_status = "deleted";
    if (companyColumns.has("deletion_requested_at")) patch.deletion_requested_at = nowIso;
    if (companyColumns.has("deleted_at")) patch.deleted_at = nowIso;
    const { error } = await admin.from("companies").update(patch).eq("id", companyId);
    if (error) return json(400, { error: "company_close_failed", details: error.message });
    return json(200, {
      ok: true,
      account: { company: { lifecycle_status: "deleted", deleted_at: nowIso } },
      user_message: "La empresa ha quedado cerrada. Conservamos la huella minima necesaria para auditoria y verificaciones historicas.",
    });
  }

  return json(400, { error: "unsupported_action" });
}

