import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import {
  buildCompanyCvImportLegalSnapshot,
  COMPANY_CV_IMPORT_LEGAL_VERSION,
  ensureCandidatePublicToken,
  persistImportedCandidateProfile,
} from "@/lib/company-candidate-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_VERSION = "public-company-candidate-import-v1";

function json(status: number, body: any) {
  return NextResponse.json({ ...body, route_version: ROUTE_VERSION }, { status });
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function isRelationMissingError(error: any, relation: string) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || msg.includes(relation.toLowerCase());
}

function displayStatus(invite: any) {
  const status = String(invite?.status || "").toLowerCase();
  const parseStatus = String(invite?.parse_status || "").toLowerCase();
  if (status === "converted") return "completed";
  if (status === "accepted") return "accepted";
  if (status === "emailed") return "pending_acceptance";
  if (parseStatus === "parse_failed") return "parse_failed";
  return "pending";
}

async function readInviteByToken(admin: any, token: string) {
  const { data, error } = await admin
    .from("company_candidate_import_invites")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();

  if (error) {
    if (isRelationMissingError(error, "company_candidate_import_invites")) {
      return {
        error: json(409, {
          error: "company_candidate_import_invites_missing_migration",
          user_message:
            "Este flujo aún no está activado en la base actual. Aplica la migración SQL para usar la aceptación de CV importado.",
          migration_files: ["scripts/sql/f36_company_candidate_cv_import_flow.sql"],
        }),
      };
    }
    return { error: json(400, { error: "invite_read_failed", details: error.message }) };
  }

  if (!data) return { error: json(404, { error: "invite_not_found", user_message: "La invitación no existe o ya no está disponible." }) };

  const companyId = String(data?.company_id || "").trim();
  let company: any = null;
  if (companyId) {
    const [{ data: companyRow }, { data: companyProfileRow }] = await Promise.all([
      admin.from("companies").select("id,name").eq("id", companyId).maybeSingle(),
      admin.from("company_profiles").select("company_id,trade_name,legal_name").eq("company_id", companyId).maybeSingle(),
    ]);
    company = { ...(companyRow || {}), ...(companyProfileRow || {}) };
  }

  return {
    invite: {
      ...data,
      company,
    },
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const normalizedToken = normalizeText(token);
    if (!normalizedToken) {
      return json(400, { error: "missing_token" });
    }

    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();
    const inviteRes = await readInviteByToken(admin, normalizedToken);
    if ((inviteRes as any).error) return (inviteRes as any).error;
    const invite = (inviteRes as any).invite;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const companyName = resolveCompanyDisplayName((invite as any)?.company || null, "Tu empresa");
    const importMeta = invite?.extracted_payload_json?._verijob_import_meta || {};
    const legalSnapshot = buildCompanyCvImportLegalSnapshot({
      companyName,
      candidateEmail: String(invite.candidate_email || ""),
      targetRole: invite.target_role || null,
    });

    return json(200, {
      invite: {
        id: String(invite.id || ""),
        candidate_email: String(invite.candidate_email || ""),
        candidate_name_raw: invite.candidate_name_raw || null,
        target_role: invite.target_role || null,
        status: String(invite.status || ""),
        parse_status: String(invite.parse_status || ""),
        created_at: invite.created_at || null,
        accepted_at: invite.accepted_at || null,
        display_status: displayStatus(invite),
        candidate_already_exists: Boolean(importMeta?.candidate_already_exists),
        existing_candidate_public_token: importMeta?.existing_candidate_public_token || null,
        company: {
          id: String(invite.company_id || ""),
          name: companyName,
        },
        extracted_payload_json: invite.extracted_payload_json || null,
      },
      auth: {
        user_id: user?.id || null,
        user_email: user?.email || null,
        email_matches_invite:
          !!user?.email && String(user.email || "").trim().toLowerCase() === String(invite.candidate_email || "").trim().toLowerCase(),
      },
      legal: {
        text_version: COMPANY_CV_IMPORT_LEGAL_VERSION,
        snapshot: legalSnapshot,
      },
    });
  } catch (error: any) {
    return json(500, {
      error: "unhandled_exception",
      user_message: "No se pudo cargar la invitacion en este momento. Intentalo de nuevo en unos minutos.",
    });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const normalizedToken = normalizeText(token);
    if (!normalizedToken) return json(400, { error: "missing_token" });

    const body = await request.json().catch(() => ({}));
    const consentProvided =
      body?.declared_cv_delivery === true &&
      body?.accepted_company_process === true &&
      body?.accepted_import_processing === true &&
      body?.understood_review_before_publish === true;
    if (!consentProvided) {
      return json(400, {
        error: "legal_consent_required",
        user_message: "Debes aceptar todas las declaraciones para continuar.",
      });
    }

    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) return json(400, { error: "auth_getUser_failed", details: userErr.message });
    if (!user) {
      return json(401, {
        error: "unauthorized",
        user_message: "Inicia sesión o crea tu cuenta para aceptar la invitación.",
      });
    }

    const inviteRes = await readInviteByToken(admin, normalizedToken);
    if ((inviteRes as any).error) return (inviteRes as any).error;
    const invite = (inviteRes as any).invite;
    const importMeta = invite?.extracted_payload_json?._verijob_import_meta || {};
    const candidateAlreadyExists = Boolean(importMeta?.candidate_already_exists);

    const userEmail = String(user.email || "").trim().toLowerCase();
    const inviteEmail = String(invite.candidate_email || "").trim().toLowerCase();
    if (!userEmail || userEmail !== inviteEmail) {
      return json(403, {
        error: "invite_email_mismatch",
        user_message: `Esta invitación está vinculada a ${inviteEmail}. Debes entrar con ese email para continuar.`,
      });
    }

    if (String(invite.status || "").toLowerCase() === "converted" && String(invite.linked_user_id || "") === user.id) {
      return json(200, {
        ok: true,
        already_completed: true,
        next_url: candidateAlreadyExists ? "/candidate/import-updates?company_cv_import=1" : "/candidate/overview?company_cv_import=1",
        user_message: candidateAlreadyExists
          ? "La invitación ya estaba aceptada y tus cambios pendientes de CV siguen disponibles para revisión."
          : "La invitación ya estaba aceptada y tu perfil ya está preparado.",
      });
    }

    const companyName = resolveCompanyDisplayName((invite as any)?.company || null, "Tu empresa");
    const legalSnapshot = buildCompanyCvImportLegalSnapshot({
      companyName,
      candidateEmail: inviteEmail,
      targetRole: invite.target_role || null,
    });
    const acceptedAt = new Date().toISOString();
    const acceptedIp =
      normalizeText(request.headers.get("x-forwarded-for")).split(",")[0]?.trim() ||
      normalizeText(request.headers.get("x-real-ip")) ||
      null;
    const acceptedUserAgent = normalizeText(request.headers.get("user-agent")) || null;

    const { error: acceptanceInsertErr } = await admin.from("company_candidate_import_acceptances").insert({
      invite_id: invite.id,
      company_id: invite.company_id,
      candidate_email: inviteEmail,
      accepted_by_user_id: user.id,
      source_flow: "company_cv_import",
      legal_text_version: COMPANY_CV_IMPORT_LEGAL_VERSION,
      legal_snapshot_json: legalSnapshot,
      accepted_at: acceptedAt,
      accepted_ip: acceptedIp,
      accepted_user_agent: acceptedUserAgent,
      cv_sha256: invite.cv_sha256 || null,
    });

    if (acceptanceInsertErr && !String(acceptanceInsertErr?.code || "").includes("23505")) {
      return json(400, { error: "acceptance_insert_failed", details: acceptanceInsertErr.message });
    }

    const persistRes = await persistImportedCandidateProfile({
      supabase: admin,
      userId: user.id,
      inviteId: String(invite.id || ""),
      extracted: invite.extracted_payload_json || {},
      candidateEmail: inviteEmail,
      companyName,
      mode: candidateAlreadyExists ? "existing_candidate" : "new_candidate",
    });

    const candidatePublicToken = await ensureCandidatePublicToken(admin, user.id);

    const { error: inviteUpdateErr } = await admin
      .from("company_candidate_import_invites")
      .update({
        accepted_by_user_id: user.id,
        linked_user_id: user.id,
        accepted_at: acceptedAt,
        accepted_ip: acceptedIp,
        accepted_user_agent: acceptedUserAgent,
        legal_text_version: COMPANY_CV_IMPORT_LEGAL_VERSION,
        status: "converted",
        updated_at: acceptedAt,
      })
      .eq("id", invite.id);

    if (inviteUpdateErr) {
      return json(400, { error: "invite_update_failed", details: inviteUpdateErr.message });
    }

    return json(200, {
      ok: true,
      accepted_at: acceptedAt,
      legal_text_version: COMPANY_CV_IMPORT_LEGAL_VERSION,
      persistence: persistRes,
      candidate_public_token: candidatePublicToken,
      next_url: candidateAlreadyExists ? "/candidate/import-updates?company_cv_import=1" : "/candidate/overview?company_cv_import=1",
      user_message: candidateAlreadyExists
        ? "Invitación aceptada. Hemos guardado los posibles cambios de CV para que revises qué quieres incorporar a tu perfil."
        : "Invitación aceptada. Tu perfil preliminar ya está preparado para revisión.",
    });
  } catch (error: any) {
    return json(500, {
      error: "unhandled_exception",
      user_message: "No se pudo aceptar la invitacion en este momento. Intentalo de nuevo en unos minutos.",
    });
  }
}
