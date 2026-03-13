import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  buildCompanyCvImportLegalSnapshot,
  COMPANY_CV_IMPORT_LEGAL_VERSION,
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

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

function isHex48(token: unknown) {
  return /^[a-f0-9]{48}$/i.test(String(token || ""));
}

async function ensureCandidatePublicToken(admin: any, userId: string) {
  const { data, error } = await admin
    .from("candidate_public_links")
    .select("id,public_token,expires_at,is_active,created_at")
    .eq("candidate_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`candidate_public_links_read_failed:${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  const canonical = rows.find((row: any) => isHex48(row?.public_token) && !isExpired(row?.expires_at));
  if (canonical?.public_token) {
    const toDeactivate = rows
      .filter((row: any) => String(row?.id || "") && String(row?.id || "") !== String(canonical.id || ""))
      .map((row: any) => String(row.id));
    if (toDeactivate.length) await admin.from("candidate_public_links").update({ is_active: false }).in("id", toDeactivate);
    return String(canonical.public_token);
  }

  const activeIds = rows.map((row: any) => String(row?.id || "")).filter(Boolean);
  if (activeIds.length) await admin.from("candidate_public_links").update({ is_active: false }).in("id", activeIds);

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertErr } = await admin.from("candidate_public_links").insert({
    candidate_id: userId,
    public_token: token,
    is_active: true,
    created_by: userId,
    expires_at: expiresAt,
  });
  if (insertErr) throw new Error(`candidate_public_links_insert_failed:${insertErr.message}`);
  return token;
}

async function readInviteByToken(admin: any, token: string) {
  const { data, error } = await admin
    .from("company_candidate_import_invites")
    .select("*, companies:company_id(id,name)")
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

  return {
    invite: data,
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

    const companyName = normalizeText((invite as any)?.companies?.name) || "la empresa";
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
    return json(500, { error: "unhandled_exception", details: String(error?.message || error) });
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
        next_url: "/candidate/overview?company_cv_import=1",
        user_message: "La invitación ya estaba aceptada y tu perfil ya está preparado.",
      });
    }

    const companyName = normalizeText((invite as any)?.companies?.name) || "la empresa";
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
      next_url: "/candidate/overview?company_cv_import=1",
      user_message: "Invitación aceptada. Tu perfil preliminar ya está preparado para revisión.",
    });
  } catch (error: any) {
    return json(500, { error: "unhandled_exception", details: String(error?.message || error) });
  }
}
