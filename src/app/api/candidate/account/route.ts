import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { buildIdentityRecord } from "@/lib/security/identity";
import { resetCandidateAccountForQa } from "@/lib/account/qa-reset";

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

  const [profileColumns, candidateProfileColumns] = await Promise.all([
    getTableColumns(admin, "profiles"),
    getTableColumns(admin, "candidate_profiles"),
  ]);

  const profileSelect = [
    "id",
    "role",
    profileColumns.has("lifecycle_status") ? "lifecycle_status" : null,
    profileColumns.has("deleted_at") ? "deleted_at" : null,
    profileColumns.has("deletion_requested_at") ? "deletion_requested_at" : null,
    profileColumns.has("deletion_mode") ? "deletion_mode" : null,
    profileColumns.has("identity_type") ? "identity_type" : null,
    profileColumns.has("identity_masked") ? "identity_masked" : null,
    profileColumns.has("identity_hash") ? "identity_hash" : null,
    profileColumns.has("full_name") ? "full_name" : null,
    profileColumns.has("title") ? "title" : null,
    profileColumns.has("location") ? "location" : null,
    profileColumns.has("active_company_id") ? "active_company_id" : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select(profileSelect)
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) return { error: json(400, { error: "profiles_read_failed", details: profileErr.message }) };
  if (String((profile as any)?.role || "").toLowerCase() !== "candidate") {
    return { error: json(403, { error: "candidate_role_required" }) };
  }

  return { user, admin, profileColumns, candidateProfileColumns, profile: profile || {} };
}

async function deactivateCandidatePublicLinks(admin: any, userId: string) {
  await admin.from("candidate_public_links").update({ is_active: false }).eq("candidate_id", userId).eq("is_active", true);
}

export async function GET() {
  const ctx = await resolveContext();
  if ((ctx as any).error) return (ctx as any).error;
  const { profile } = ctx as any;
  return json(200, {
    account: {
      lifecycle_status: String((profile as any)?.lifecycle_status || "active"),
      deleted_at: (profile as any)?.deleted_at || null,
      deletion_requested_at: (profile as any)?.deletion_requested_at || null,
      deletion_mode: (profile as any)?.deletion_mode || null,
      identity_type: (profile as any)?.identity_type || null,
      identity_masked: (profile as any)?.identity_masked || null,
      has_identity: Boolean((profile as any)?.identity_hash),
    },
  });
}

export async function POST(request: Request) {
  const ctx = await resolveContext();
  if ((ctx as any).error) return (ctx as any).error;
  const { user, admin, profileColumns, candidateProfileColumns } = ctx as any;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  const nowIso = new Date().toISOString();

  if (action === "update_identity") {
    try {
      const identity = buildIdentityRecord({ type: body?.identity_type, value: body?.identity_value });
      if (!identity.identityType || !identity.identityMasked || !identity.identityHash) {
        return json(400, { error: "invalid_identity", user_message: "Introduce un documento valido para asociar la identidad." });
      }
      const patch: Record<string, any> = {};
      if (profileColumns.has("identity_type")) patch.identity_type = identity.identityType;
      if (profileColumns.has("identity_masked")) patch.identity_masked = identity.identityMasked;
      if (profileColumns.has("identity_hash")) patch.identity_hash = identity.identityHash;
      const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
      if (error) return json(400, { error: "identity_update_failed", details: error.message });
      return json(200, {
        ok: true,
        account: {
          identity_type: identity.identityType,
          identity_masked: identity.identityMasked,
          has_identity: true,
        },
      });
    } catch (error: any) {
      return json(500, { error: "identity_hash_failed", details: String(error?.message || error) });
    }
  }

  if (action === "clear_identity") {
    const patch: Record<string, any> = {};
    if (profileColumns.has("identity_type")) patch.identity_type = null;
    if (profileColumns.has("identity_masked")) patch.identity_masked = null;
    if (profileColumns.has("identity_hash")) patch.identity_hash = null;
    const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
    if (error) return json(400, { error: "identity_clear_failed", details: error.message });
    return json(200, { ok: true, account: { identity_type: null, identity_masked: null, has_identity: false } });
  }

  if (action === "disable_profile") {
    const patch: Record<string, any> = {};
    if (profileColumns.has("lifecycle_status")) patch.lifecycle_status = "disabled";
    if (profileColumns.has("deletion_requested_at")) patch.deletion_requested_at = nowIso;
    if (profileColumns.has("deletion_mode")) patch.deletion_mode = "temporary";
    if (profileColumns.has("deleted_at")) patch.deleted_at = null;
    const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
    if (error) return json(400, { error: "profile_disable_failed", details: error.message });
    await deactivateCandidatePublicLinks(admin, user.id);
    return json(200, {
      ok: true,
      account: { lifecycle_status: "disabled", deletion_mode: "temporary", deletion_requested_at: nowIso },
      user_message: "Tu perfil ha quedado desactivado temporalmente. El perfil publico ya no esta disponible.",
    });
  }

  if (action === "reactivate_profile") {
    const patch: Record<string, any> = {};
    if (profileColumns.has("lifecycle_status")) patch.lifecycle_status = "active";
    if (profileColumns.has("deletion_requested_at")) patch.deletion_requested_at = null;
    if (profileColumns.has("deletion_mode")) patch.deletion_mode = null;
    if (profileColumns.has("deleted_at")) patch.deleted_at = null;
    const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
    if (error) return json(400, { error: "profile_reactivate_failed", details: error.message });
    return json(200, {
      ok: true,
      account: { lifecycle_status: "active", deletion_mode: null, deletion_requested_at: null },
      user_message: "Tu perfil vuelve a estar activo.",
    });
  }

  if (action === "delete_profile") {
    const profilePatch: Record<string, any> = {};
    if (profileColumns.has("lifecycle_status")) profilePatch.lifecycle_status = "deleted";
    if (profileColumns.has("deletion_requested_at")) profilePatch.deletion_requested_at = nowIso;
    if (profileColumns.has("deletion_mode")) profilePatch.deletion_mode = "permanent";
    if (profileColumns.has("deleted_at")) profilePatch.deleted_at = nowIso;
    if (profileColumns.has("full_name")) profilePatch.full_name = "Perfil eliminado";
    if (profileColumns.has("title")) profilePatch.title = null;
    if (profileColumns.has("location")) profilePatch.location = null;
    if (profileColumns.has("identity_type")) profilePatch.identity_type = null;
    if (profileColumns.has("identity_masked")) profilePatch.identity_masked = null;
    if (profileColumns.has("identity_hash")) profilePatch.identity_hash = null;

    const { error: profileError } = await admin.from("profiles").update(profilePatch).eq("id", user.id);
    if (profileError) return json(400, { error: "profile_delete_failed", details: profileError.message });

    const candidatePatch: Record<string, any> = {};
    if (candidateProfileColumns.has("summary")) candidatePatch.summary = null;
    if (candidateProfileColumns.has("education")) candidatePatch.education = [];
    if (candidateProfileColumns.has("certifications")) candidatePatch.certifications = [];
    if (candidateProfileColumns.has("job_search_status")) candidatePatch.job_search_status = "no_disponible";
    if (candidateProfileColumns.has("preferred_workday")) candidatePatch.preferred_workday = "flexible";
    if (candidateProfileColumns.has("preferred_roles")) candidatePatch.preferred_roles = [];
    if (candidateProfileColumns.has("work_zones")) candidatePatch.work_zones = null;
    if (candidateProfileColumns.has("availability_schedule")) candidatePatch.availability_schedule = [];
    if (candidateProfileColumns.has("allow_company_email_contact")) candidatePatch.allow_company_email_contact = false;
    if (candidateProfileColumns.has("allow_company_phone_contact")) candidatePatch.allow_company_phone_contact = false;
    if (candidateProfileColumns.has("show_trust_score")) candidatePatch.show_trust_score = false;
    if (candidateProfileColumns.has("show_verification_counts")) candidatePatch.show_verification_counts = false;
    if (candidateProfileColumns.has("show_verified_timeline")) candidatePatch.show_verified_timeline = false;
    if (candidateProfileColumns.has("raw_cv_json")) candidatePatch.raw_cv_json = null;
    if (candidateProfileColumns.has("updated_at")) candidatePatch.updated_at = nowIso;

    if (Object.keys(candidatePatch).length > 0) {
      await admin.from("candidate_profiles").update(candidatePatch).eq("user_id", user.id);
    }

    await deactivateCandidatePublicLinks(admin, user.id);

    try {
      await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
    } catch {}

    return json(200, {
      ok: true,
      account: { lifecycle_status: "deleted", deletion_mode: "permanent", deleted_at: nowIso },
      user_message: "Tu perfil ha quedado eliminado. Conservamos solo la informacion minima necesaria para integridad tecnica e historica.",
    });
  }

  if (action === "reset_candidate_for_qa") {
    if (String(body?.confirm_phrase || "").trim().toUpperCase() !== "RESET CANDIDATO") {
      return json(400, {
        error: "invalid_confirmation_phrase",
        user_message: "Escribe exactamente RESET CANDIDATO para confirmar el reseteo de prueba.",
      });
    }

    let result;
    try {
      result = await resetCandidateAccountForQa({
        admin,
        userId: user.id,
        userEmail: user.email || "",
      });
    } catch (error: any) {
      return json(500, {
        error: "candidate_reset_failed",
        details: String(error?.message || error),
        user_message: "No se pudo resetear la cuenta candidata de prueba. Revisa dependencias históricas pendientes o intenta de nuevo.",
      });
    }

    if (!result?.ok) {
      return json(result?.error === "candidate_reset_forbidden" ? 403 : 400, {
        error: result?.error || "candidate_reset_failed",
        user_message: result?.user_message || "No se pudo resetear la cuenta candidata de prueba.",
      });
    }

    return json(200, {
      ok: true,
      account: {
        lifecycle_status: "active",
        deletion_mode: null,
        deletion_requested_at: null,
        deleted_at: null,
        identity_type: null,
        identity_masked: null,
        has_identity: false,
      },
      cleaned: result.cleaned,
      validation: result.validation,
      user_message: "Cuenta candidata de prueba reseteada correctamente.",
    });
  }

  return json(400, { error: "unsupported_action" });
}
