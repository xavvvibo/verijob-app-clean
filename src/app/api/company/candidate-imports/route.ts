import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import {
  ensureCandidatePublicToken,
  extractStructuredCvFromBuffer,
  sha256Hex,
} from "@/lib/company-candidate-import";
import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";
import { buildCompanyCandidateImportInviteEmail } from "@/lib/email/templates/companyCandidateImportInvite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_VERSION = "company-candidate-imports-v1";
const BUCKET = "candidate-cv";
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function json(status: number, body: any) {
  return NextResponse.json({ ...body, route_version: ROUTE_VERSION }, { status });
}

function isRelationMissingError(error: any, relation: string) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || msg.includes(relation.toLowerCase());
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function safeFilename(filename: string) {
  return filename.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "cv";
}

function extFromFilename(filename: string) {
  const clean = safeFilename(filename || "cv");
  const ext = clean.split(".").pop()?.toLowerCase() || "pdf";
  if (["pdf", "doc", "docx"].includes(ext)) return ext;
  return "pdf";
}

function formatImportStatus(row: any) {
  const alreadyExists = Boolean(row?.candidate_already_exists);
  const status = String(row?.status || "").toLowerCase();
  const parseStatus = String(row?.parse_status || "").toLowerCase();
  const approved = Number(row?.approved_verifications || 0);
  const total = Number(row?.total_verifications || 0);

  if (alreadyExists && status === "emailed") return "existing_candidate";
  if (status === "converted" && approved > 0) return "verified";
  if (status === "converted" && total > 0) return "verifying";
  if (status === "converted" || status === "accepted") return "profile_created";
  if (status === "emailed") return "acceptance_pending";
  if (parseStatus === "parse_failed") return "parse_failed";
  if (parseStatus === "processing" || parseStatus === "import_pending") return "processing";
  return "uploaded";
}

function normalizeCompanyStage(value: unknown) {
  const stage = String(value || "").toLowerCase();
  if (stage === "saved") return "saved";
  if (stage === "preselected") return "preselected";
  return "none";
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

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) return { error: json(400, { error: "profiles_read_failed", details: profileErr.message }) };

  let companyId = profile?.active_company_id ? String(profile.active_company_id) : null;
  if (!companyId) {
    const { data: latestMembership, error: membershipErr } = await admin
      .from("company_members")
      .select("company_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (membershipErr) return { error: json(400, { error: "company_members_read_failed", details: membershipErr.message }) };
    companyId = latestMembership?.company_id ? String(latestMembership.company_id) : null;
  }
  if (!companyId) return { error: json(400, { error: "no_active_company" }) };

  const [{ data: membership, error: membershipErr }, { data: company, error: companyErr }] = await Promise.all([
    admin.from("company_members").select("role").eq("company_id", companyId).eq("user_id", user.id).maybeSingle(),
    admin.from("companies").select("id,name,trade_name,legal_name").eq("id", companyId).maybeSingle(),
  ]);

  if (membershipErr) return { error: json(400, { error: "company_membership_read_failed", details: membershipErr.message }) };
  if (!membership) return { error: json(403, { error: "company_membership_required" }) };
  if (companyErr) return { error: json(400, { error: "companies_read_failed", details: companyErr.message }) };

  return {
    user,
    companyId,
    membershipRole: String(membership.role || "reviewer").toLowerCase(),
    companyName: resolveCompanyDisplayName(company, "Tu empresa"),
    admin,
  };
}

async function readInvitesSnapshot(admin: any, companyId: string) {
  const invitesRes = await admin
    .from("company_candidate_import_invites")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (invitesRes.error) {
    if (isRelationMissingError(invitesRes.error, "company_candidate_import_invites")) {
      return {
        invites: [],
        meta: {
          available: false,
          warning_code: "company_candidate_import_invites_missing_migration",
          warning_message:
            "La base actual aún no tiene activado el flujo de importación empresa → candidato. Aplica la migración SQL para usar este módulo.",
          migration_files: ["scripts/sql/f36_company_candidate_cv_import_flow.sql"],
        },
      };
    }
    throw new Error(invitesRes.error.message);
  }

  const baseInvites = Array.isArray(invitesRes.data) ? invitesRes.data : [];
  const linkedUserIds = baseInvites.map((row: any) => String(row?.linked_user_id || "")).filter(Boolean);
  const [linkedProfilesRes, verificationSummaryRes, linkedCandidateProfilesRes, linkedPublicLinksRes] = linkedUserIds.length
    ? await Promise.all([
        admin.from("profiles").select("id,full_name,email").in("id", linkedUserIds),
        admin.from("verification_summary").select("user_id,status").in("user_id", linkedUserIds),
        admin.from("candidate_profiles").select("user_id,trust_score").in("user_id", linkedUserIds),
        admin
          .from("candidate_public_links")
          .select("candidate_id,public_token,is_active,created_at")
          .in("candidate_id", linkedUserIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ])
    : [
        { data: [], error: null } as any,
        { data: [], error: null } as any,
        { data: [], error: null } as any,
        { data: [], error: null } as any,
      ];

  const profilesById = new Map(
    (Array.isArray(linkedProfilesRes.data) ? linkedProfilesRes.data : []).map((row: any) => [String(row.id), row]),
  );
  const trustById = new Map(
    (Array.isArray(linkedCandidateProfilesRes.data) ? linkedCandidateProfilesRes.data : []).map((row: any) => [
      String(row.user_id),
      Number(row.trust_score || 0),
    ]),
  );
  const publicTokenByUserId = new Map<string, string>();
  for (const row of Array.isArray(linkedPublicLinksRes.data) ? linkedPublicLinksRes.data : []) {
    const userId = String(row?.candidate_id || "");
    const token = normalizeText(row?.public_token);
    if (!userId || !token || publicTokenByUserId.has(userId)) continue;
    publicTokenByUserId.set(userId, token);
  }
  const verificationStats = new Map<string, { total: number; approved: number }>();
  for (const row of Array.isArray(verificationSummaryRes.data) ? verificationSummaryRes.data : []) {
    const userId = String(row?.user_id || "");
    if (!userId) continue;
    const current = verificationStats.get(userId) || { total: 0, approved: 0 };
    current.total += 1;
    if (String(row?.status || "").toLowerCase() === "approved") current.approved += 1;
    verificationStats.set(userId, current);
  }

  const invites = baseInvites.map((row: any) => {
    const linkedUserId = String(row?.linked_user_id || "");
    const linkedProfile = (linkedUserId ? profilesById.get(linkedUserId) : null) as any;
    const stats = linkedUserId ? verificationStats.get(linkedUserId) || { total: 0, approved: 0 } : { total: 0, approved: 0 };
    const importMeta = row?.extracted_payload_json?._verijob_import_meta || {};
    const companyState = row?.extracted_payload_json?._verijob_company_state || {};
    const normalized = {
      ...row,
      candidate_already_exists: Boolean(importMeta?.candidate_already_exists),
      linked_profile_name: normalizeText(linkedProfile?.full_name) || null,
      linked_profile_email: normalizeText(linkedProfile?.email) || null,
      candidate_public_token: linkedUserId ? publicTokenByUserId.get(linkedUserId) ?? null : null,
      trust_score: linkedUserId ? trustById.get(linkedUserId) ?? null : null,
      total_verifications: stats.total,
      approved_verifications: stats.approved,
      company_stage: normalizeCompanyStage(companyState?.stage),
      company_stage_updated_at: companyState?.updated_at || null,
      last_activity_at:
        row?.accepted_at ||
        row?.emailed_at ||
        companyState?.updated_at ||
        row?.updated_at ||
        row?.created_at ||
        null,
    };
    return {
      ...normalized,
      display_status: formatImportStatus(normalized),
    };
  });

  return {
    invites,
    meta: {
      available: true,
      warning_code: null,
      warning_message: null,
      migration_files: [] as string[],
    },
  };
}

export async function GET() {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { companyId, membershipRole, companyName, admin } = ctx as any;
    const snapshot = await readInvitesSnapshot(admin, companyId);
    return json(200, {
      company_id: companyId,
      company_name: companyName,
      membership_role: membershipRole,
      imports: snapshot.invites,
      imports_meta: snapshot.meta,
    });
  } catch (error: any) {
    return json(500, { error: "unhandled_exception", details: String(error?.message || error) });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { user, companyId, membershipRole, companyName, admin } = ctx as any;

    if (membershipRole !== "admin") {
      return json(403, { error: "forbidden", user_message: "Solo administradores pueden invitar candidatos desde CV." });
    }

    const preflight = await admin.from("company_candidate_import_invites").select("id").limit(1);
    if (preflight.error && isRelationMissingError(preflight.error, "company_candidate_import_invites")) {
      return json(409, {
        error: "company_candidate_import_invites_missing_migration",
        user_message:
          "La base actual aún no tiene activado el flujo de importación empresa → candidato. Aplica la migración SQL antes de usar este módulo.",
        migration_files: ["scripts/sql/f36_company_candidate_cv_import_flow.sql"],
      });
    }

    const form = await request.formData();
    const candidateEmail = normalizeText(form.get("candidate_email")).toLowerCase();
    const candidateNameRaw = normalizeText(form.get("candidate_name"));
    const targetRole = normalizeText(form.get("target_role")) || null;
    const sourceNotes = normalizeText(form.get("source_notes")) || null;
    const file = form.get("file");

    if (!candidateEmail || !candidateEmail.includes("@")) {
      return json(400, { error: "invalid_candidate_email", user_message: "Introduce un email válido del candidato." });
    }
    if (!(file instanceof File)) {
      return json(400, { error: "file_required", user_message: "Adjunta un CV en PDF, DOC o DOCX." });
    }
    if (!ALLOWED_MIME.has(file.type || "")) {
      return json(400, {
        error: "invalid_mime_type",
        user_message: "Formato no compatible. Usa PDF, DOC o DOCX.",
      });
    }
    if (!file.size || file.size <= 0 || file.size > MAX_SIZE_BYTES) {
      return json(400, {
        error: "invalid_file_size",
        user_message: "El CV debe pesar menos de 10 MB.",
        max_size_bytes: MAX_SIZE_BYTES,
      });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const cvHash = sha256Hex(bytes);
    const inviteId = randomUUID();
    const inviteToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const ext = extFromFilename(file.name || "cv");
    const storagePath = `company-imports/${companyId}/${Date.now()}-${randomUUID()}.${ext}`;
    const nowIso = new Date().toISOString();
    const { data: existingCandidateProfile } = await admin
      .from("profiles")
      .select("id,role,full_name,email")
      .eq("email", candidateEmail)
      .maybeSingle();
    const existingCandidateUserId =
      String(existingCandidateProfile?.role || "").toLowerCase() === "candidate" && existingCandidateProfile?.id
        ? String(existingCandidateProfile.id)
        : null;
    const existingCandidatePublicToken = existingCandidateUserId
      ? await ensureCandidatePublicToken(admin, existingCandidateUserId)
      : null;

    const uploadRes = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadRes.error) {
      return json(400, {
        error: "storage_upload_failed",
        details: uploadRes.error.message,
        user_message: "No se pudo subir el CV. Inténtalo de nuevo.",
      });
    }

    let inviteInsert = await admin
      .from("company_candidate_import_invites")
      .insert({
        id: inviteId,
        company_id: companyId,
        invited_by_user_id: user.id,
        linked_user_id: existingCandidateUserId,
        candidate_email: candidateEmail,
        candidate_name_raw: candidateNameRaw || null,
        target_role: targetRole,
        source: "company_cv_upload",
        source_notes: sourceNotes,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        original_filename: safeFilename(file.name || "cv"),
        mime_type: file.type,
        size_bytes: file.size,
        cv_sha256: cvHash,
        parse_status: "processing",
        invite_token: inviteToken,
        status: "uploaded",
        email_delivery_status: "pending",
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (inviteInsert.error) {
      if (isRelationMissingError(inviteInsert.error, "company_candidate_import_invites")) {
        return json(409, {
          error: "company_candidate_import_invites_missing_migration",
          user_message:
            "La base actual aún no tiene activado el flujo de importación empresa → candidato. Aplica la migración SQL antes de usar este módulo.",
          migration_files: ["scripts/sql/f36_company_candidate_cv_import_flow.sql"],
        });
      }
      return json(400, { error: "company_candidate_import_invite_insert_failed", details: inviteInsert.error.message });
    }

    let parseStatus = "parse_failed";
    let extractedPayload: any = {
      _verijob_import_meta: {
        candidate_already_exists: Boolean(existingCandidateUserId),
        existing_candidate_user_id: existingCandidateUserId,
        existing_candidate_public_token: existingCandidatePublicToken,
      },
    };
    let extractedWarnings: string[] = [];
    let parseError: string | null = null;

    try {
      const openaiApiKey = normalizeText(process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || process.env.OPENAI_KEY);
      if (!openaiApiKey) throw new Error("missing_openai_api_key");
      const parsed = await extractStructuredCvFromBuffer({
        fileBuffer: bytes,
        filename: file.name || "cv",
        openaiApiKey,
      });
      parseStatus = "parsed_ready";
      extractedPayload = {
        ...parsed.extracted,
        _verijob_import_meta: {
          candidate_already_exists: Boolean(existingCandidateUserId),
          existing_candidate_user_id: existingCandidateUserId,
          existing_candidate_public_token: existingCandidatePublicToken,
        },
      };
      extractedWarnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    } catch (error: any) {
      parseStatus = "parse_failed";
      parseError = String(error?.message || error);
    }

    const appUrl = normalizeText(process.env.NEXT_PUBLIC_APP_URL) || "https://app.verijob.es";
    const acceptanceLink = `${appUrl.replace(/\/$/, "")}/company-candidate-import/${inviteToken}`;
    const emailTemplate = buildCompanyCandidateImportInviteEmail({
      companyName,
      candidateEmail,
      candidateName: candidateNameRaw || null,
      targetRole,
      acceptanceLink,
    });
    const emailRes = await sendTransactionalEmail({
      to: candidateEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    const nextStatus = emailRes.ok ? "emailed" : "uploaded";
    const emailDeliveryStatus = emailRes.ok ? "sent" : emailRes.skipped ? "skipped" : "failed";
    const lastError = parseError || emailRes.error || null;

    const { data: updatedInvite, error: updateErr } = await admin
      .from("company_candidate_import_invites")
      .update({
        parse_status: parseStatus,
        extracted_payload_json: extractedPayload,
        extracted_warnings: extractedWarnings,
        status: nextStatus,
        email_delivery_status: emailDeliveryStatus,
        emailed_at: emailRes.ok ? new Date().toISOString() : null,
        last_error: lastError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .select("*")
      .single();

    if (updateErr) {
      return json(400, { error: "company_candidate_import_invite_update_failed", details: updateErr.message });
    }

    return json(200, {
      ok: true,
      import_invite: (() => {
        const normalizedInvite = {
          ...updatedInvite,
          candidate_already_exists: Boolean(existingCandidateUserId),
          candidate_public_token: existingCandidatePublicToken,
        };
        return {
          ...normalizedInvite,
          display_status: formatImportStatus(normalizedInvite),
        };
      })(),
      user_message: emailRes.ok
        ? existingCandidateUserId
          ? "El CV se ha asociado a un candidato ya existente y se le ha solicitado revisar o actualizar su perfil."
          : "CV importado y candidatura enviada al candidato."
        : "El CV se ha importado, pero el email no pudo enviarse automáticamente.",
      acceptance_link: acceptanceLink,
      candidate_already_exists: Boolean(existingCandidateUserId),
      existing_candidate_user_id: existingCandidateUserId,
      existing_candidate_public_token: existingCandidatePublicToken,
      parsing: {
        status: parseStatus,
        warnings: extractedWarnings,
      },
      email: {
        ok: emailRes.ok,
        status: emailDeliveryStatus,
        error: emailRes.error || null,
      },
    });
  } catch (error: any) {
    return json(500, { error: "unhandled_exception", details: String(error?.message || error) });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { companyId, membershipRole, admin } = ctx as any;

    if (!["admin", "reviewer"].includes(membershipRole)) {
      return json(403, { error: "forbidden", user_message: "No tienes permisos para actualizar esta base de candidatos." });
    }

    const body = await request.json().catch(() => ({}));
    const inviteId = normalizeText(body?.invite_id);
    const action = normalizeText(body?.action).toLowerCase();
    const nextStage = normalizeCompanyStage(body?.stage);

    if (!inviteId) {
      return json(400, { error: "invite_id_required", user_message: "Falta el candidato que quieres actualizar." });
    }
    if (action !== "set_stage") {
      return json(400, { error: "unsupported_action", user_message: "La acción solicitada no está soportada." });
    }

    const { data: inviteRow, error: inviteErr } = await admin
      .from("company_candidate_import_invites")
      .select("id,company_id,extracted_payload_json")
      .eq("id", inviteId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (inviteErr) {
      if (isRelationMissingError(inviteErr, "company_candidate_import_invites")) {
        return json(409, {
          error: "company_candidate_import_invites_missing_migration",
          user_message: "La base actual aún no tiene activada la base de candidatos importados.",
          migration_files: ["scripts/sql/f36_company_candidate_cv_import_flow.sql"],
        });
      }
      return json(400, { error: "company_candidate_import_invite_read_failed", details: inviteErr.message });
    }

    if (!inviteRow?.id) {
      return json(404, { error: "import_invite_not_found", user_message: "No se encontró ese candidato importado." });
    }

    const currentPayload =
      inviteRow?.extracted_payload_json && typeof inviteRow.extracted_payload_json === "object"
        ? inviteRow.extracted_payload_json
        : {};
    const nowIso = new Date().toISOString();
    const nextPayload = {
      ...currentPayload,
      _verijob_company_state: {
        stage: nextStage,
        updated_at: nowIso,
      },
    };

    const { data: updatedRow, error: updateErr } = await admin
      .from("company_candidate_import_invites")
      .update({
        extracted_payload_json: nextPayload,
        updated_at: nowIso,
      })
      .eq("id", inviteId)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (updateErr) {
      return json(400, {
        error: "company_candidate_import_invite_update_failed",
        details: updateErr.message,
        user_message: "No se pudo actualizar el estado interno del candidato.",
      });
    }

    return json(200, {
      ok: true,
      invite: {
        ...updatedRow,
        company_stage: nextStage,
        last_activity_at: nowIso,
        display_status: formatImportStatus(updatedRow),
      },
      user_message:
        nextStage === "preselected"
          ? "Candidato marcado como preseleccionado."
          : nextStage === "saved"
            ? "Candidato guardado en tu base interna."
            : "Estado interno eliminado.",
    });
  } catch (error: any) {
    return json(500, { error: "unhandled_exception", details: String(error?.message || error) });
  }
}
