import { randomUUID } from "crypto";
import { after, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { isCompanyLifecycleBlocked, readCompanyLifecycle } from "@/lib/company/lifecycle-guard";
import { resolveSafeCandidateName } from "@/lib/company-candidate-import-shared";
import {
  extractStructuredCvFromBuffer,
  ensureCandidatePublicToken,
  sha256Hex,
} from "@/lib/company-candidate-import";
import { resolveCompanyProfileAccessCredits } from "@/lib/company/profile-access-credits";
import { resolveCompanyCandidateAccessMap } from "@/lib/company/profile-access";
import { dispatchBackgroundJob } from "@/lib/jobs/background-processing";
import { reconcileExternalVerificationCandidates } from "@/lib/company/reconcile-external-verification-candidates";

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

function normalizeNameForMatch(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesReasonablyMatch(left: unknown, right: unknown) {
  const a = normalizeNameForMatch(left);
  const b = normalizeNameForMatch(right);
  if (!a || !b) return true;
  if (a === b) return true;
  const aParts = a.split(" ").filter(Boolean);
  const bParts = b.split(" ").filter(Boolean);
  if (!aParts.length || !bParts.length) return true;
  return aParts.some((part) => bParts.includes(part));
}

function formatImportStatus(row: any) {
  const status = String(row?.status || "").toLowerCase();
  const parseStatus = String(row?.parse_status || "").toLowerCase();
  const approved = Number(row?.approved_verifications || 0);
  const total = Number(row?.total_verifications || 0);
  const archived = String(row?.company_stage || "").toLowerCase() === "archived";

  if (archived) return "ready";
  if (status === "converted" || approved > 0 || total > 0 || Boolean(row?.linked_user_id)) return "ready";
  if (parseStatus === "parse_failed" || parseStatus === "processing" || parseStatus === "import_pending" || status === "emailed" || status === "accepted") {
    return "in_review";
  }
  return "new";
}

function normalizeCompanyStage(value: unknown) {
  const stage = String(value || "").toLowerCase();
  if (stage === "saved") return "saved";
  if (stage === "preselected") return "preselected";
  if (stage === "archived") return "archived";
  return "none";
}

function yearsFromExperiences(experiences: any[] | null | undefined) {
  const rows = Array.isArray(experiences) ? experiences : [];
  const dates = rows
    .flatMap((item: any) => [item?.start_date || null, item?.end_date || null])
    .filter(Boolean)
    .map((value: any) => Date.parse(String(value)));
  const valid = dates.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid, Date.now());
  const years = Math.max(0, Math.round(((max - min) / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10);
  return years > 0 ? Math.round(years) : null;
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

  const [
    { data: membership, error: membershipErr },
    { data: company, error: companyErr },
    { data: companyProfile, error: companyProfileErr },
  ] = await Promise.all([
    admin.from("company_members").select("role").eq("company_id", companyId).eq("user_id", user.id).maybeSingle(),
    admin.from("companies").select("id,name").eq("id", companyId).maybeSingle(),
    admin.from("company_profiles").select("company_id,trade_name,legal_name").eq("company_id", companyId).maybeSingle(),
  ]);

  if (membershipErr) return { error: json(400, { error: "company_membership_read_failed", details: membershipErr.message }) };
  if (!membership) return { error: json(403, { error: "company_membership_required" }) };
  if (companyErr) return { error: json(400, { error: "companies_read_failed", details: companyErr.message }) };
  if (companyProfileErr) return { error: json(400, { error: "company_profiles_read_failed", details: companyProfileErr.message }) };

  return {
    user,
    companyId,
    membershipRole: String(membership.role || "reviewer").toLowerCase(),
    companyName: resolveCompanyDisplayName({ ...(company || {}), ...(companyProfile || {}) }, "Tu empresa"),
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
        admin.from("profiles").select("id,full_name,email,location").in("id", linkedUserIds),
        admin.from("verification_summary").select("user_id,status").in("user_id", linkedUserIds),
        admin.from("candidate_profiles").select("user_id,trust_score,preferred_roles,work_zones,raw_cv_json").in("user_id", linkedUserIds),
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
  const accessByCandidateId = await resolveCompanyCandidateAccessMap({
    service: admin,
    companyId,
    candidateIds: linkedUserIds,
  });

  const invites = baseInvites.map((row: any) => {
    const linkedUserId = String(row?.linked_user_id || "");
    const linkedProfile = (linkedUserId ? profilesById.get(linkedUserId) : null) as any;
    const stats = linkedUserId ? verificationStats.get(linkedUserId) || { total: 0, approved: 0 } : { total: 0, approved: 0 };
    const access = linkedUserId ? accessByCandidateId.get(linkedUserId) : null;
    const importMeta = row?.extracted_payload_json?._verijob_import_meta || {};
    const companyState = row?.extracted_payload_json?._verijob_company_state || {};
    const extractedPayload = row?.extracted_payload_json && typeof row.extracted_payload_json === "object" ? row.extracted_payload_json : {};
    const linkedCandidateProfile = linkedUserId ? (Array.isArray(linkedCandidateProfilesRes.data) ? linkedCandidateProfilesRes.data.find((item: any) => String(item?.user_id || "") === linkedUserId) : null) : null;
    const importedPayload = linkedCandidateProfile?.raw_cv_json?.company_cv_import?.extracted_payload || extractedPayload;
    const preferredRoles = Array.isArray(linkedCandidateProfile?.preferred_roles) ? linkedCandidateProfile.preferred_roles : [];
    const partialSector =
      String(preferredRoles?.[0] || extractedPayload?.headline || row?.target_role || "").trim() || null;
    const partialLocation =
      normalizeText(linkedProfile?.location) ||
      normalizeText(linkedCandidateProfile?.work_zones) ||
      normalizeText(importedPayload?.experiences?.[0]?.location) ||
      null;
    const partialYearsExperience = yearsFromExperiences(importedPayload?.experiences);
    const normalized = {
      ...row,
      candidate_already_exists: Boolean(importMeta?.candidate_already_exists),
      linked_profile_name: resolveSafeCandidateName(linkedProfile?.full_name, linkedProfile?.email || row?.candidate_email),
      candidate_name_raw: resolveSafeCandidateName(row?.candidate_name_raw, row?.candidate_email),
      linked_profile_email: normalizeText(linkedProfile?.email) || null,
      candidate_public_token: linkedUserId ? publicTokenByUserId.get(linkedUserId) ?? null : null,
      trust_score: linkedUserId ? trustById.get(linkedUserId) ?? null : null,
      total_verifications: stats.total,
      approved_verifications: stats.approved,
      company_stage: normalizeCompanyStage(companyState?.stage),
      company_stage_updated_at: companyState?.updated_at || null,
      access_status: access?.access_status || "never",
      access_granted_at: access?.access_granted_at || null,
      access_expires_at: access?.access_expires_at || null,
      access_source: access?.source || null,
      partial_sector: partialSector,
      partial_years_experience: partialYearsExperience,
      partial_location: partialLocation,
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

  const dedupedInvites = new Map<string, any>();
  for (const row of invites) {
    const identityKey = row.linked_user_id
      ? `user:${String(row.linked_user_id)}`
      : `email:${String(row.candidate_email || "").trim().toLowerCase()}`;
    const previous = dedupedInvites.get(identityKey);
    if (!previous) {
      dedupedInvites.set(identityKey, { ...row, import_attempts: 1 });
      continue;
    }
    const previousTs = Date.parse(String(previous.last_activity_at || previous.updated_at || previous.created_at || 0));
    const currentTs = Date.parse(String(row.last_activity_at || row.updated_at || row.created_at || 0));
    const winner = currentTs >= previousTs ? row : previous;
    dedupedInvites.set(identityKey, {
      ...winner,
      import_attempts: Number(previous.import_attempts || 1) + 1,
      candidate_already_exists: Boolean(previous.candidate_already_exists || row.candidate_already_exists),
      total_verifications: Math.max(Number(previous.total_verifications || 0), Number(row.total_verifications || 0)),
      approved_verifications: Math.max(Number(previous.approved_verifications || 0), Number(row.approved_verifications || 0)),
    });
  }

  return {
    invites: Array.from(dedupedInvites.values()),
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
    const { companyId, membershipRole, companyName, admin, user } = ctx as any;
    await reconcileExternalVerificationCandidates({
      admin,
      companyId,
      invitedByUserId: user?.id || null,
    }).catch(() => {});
    const snapshot = await readInvitesSnapshot(admin, companyId);
    const profileAccessCredits = await resolveCompanyProfileAccessCredits({
      service: admin,
      userId: String(user.id),
      companyId,
    });

    return json(200, {
      company_id: companyId,
      company_name: companyName,
      membership_role: membershipRole,
      available_profile_accesses: profileAccessCredits.available,
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
    const { user, companyId, membershipRole, admin } = ctx as any;
    const companyLifecycle = await readCompanyLifecycle(admin, companyId);
    if (!companyLifecycle.ok) {
      return json(400, { error: "company_read_failed", details: companyLifecycle.error.message });
    }
    if (isCompanyLifecycleBlocked(companyLifecycle.lifecycleStatus)) {
      return json(423, {
        error: "company_inactive",
        user_message: "La empresa esta desactivada o cerrada. Reactivala desde ajustes antes de importar nuevos CV.",
      });
    }

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
    const previewOnly = normalizeText(form.get("preview_only")) === "1";
    const file = form.get("file");

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
    const openaiApiKey = normalizeText(process.env.OPENAI_API_KEY) || normalizeText(process.env.OPENAI_KEY) || null;
    const previewParsed = await extractStructuredCvFromBuffer({
      fileBuffer: bytes,
      filename: file.name || "cv",
      openaiApiKey,
    });
    const detectedEmail = normalizeText(previewParsed?.structured?.email).toLowerCase() || candidateEmail;
    const detectedName = resolveSafeCandidateName(
      previewParsed?.structured?.full_name || candidateNameRaw,
      detectedEmail || candidateEmail
    );
    const candidateNameToPersist = candidateNameRaw || detectedName;
    const previewRole = normalizeText(previewParsed?.structured?.headline) || targetRole || null;
    const previewWarnings = Array.isArray(previewParsed?.warnings) ? previewParsed.warnings : [];
    const lookupEmail = detectedEmail || candidateEmail;

    if (!lookupEmail || !lookupEmail.includes("@")) {
      return json(400, { error: "invalid_candidate_email", user_message: "Introduce un email válido del candidato." });
    }
    const cvHash = sha256Hex(bytes);
    const inviteId = randomUUID();
    const inviteToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const ext = extFromFilename(file.name || "cv");
    const storagePath = `company-imports/${companyId}/${Date.now()}-${randomUUID()}.${ext}`;
    const nowIso = new Date().toISOString();
    const { data: existingCandidateProfile } = await admin
      .from("profiles")
      .select("id,role,full_name,email")
      .eq("email", lookupEmail)
      .maybeSingle();
    const existingCandidateUserId =
      String(existingCandidateProfile?.role || "").toLowerCase() === "candidate" && existingCandidateProfile?.id
        ? String(existingCandidateProfile.id)
        : null;
    const existingCandidatePublicToken = existingCandidateUserId
      ? await ensureCandidatePublicToken(admin, existingCandidateUserId)
      : null;
    const existingProfileName = normalizeText(existingCandidateProfile?.full_name) || null;
    const identityNameMismatch =
      Boolean(existingCandidateUserId) &&
      Boolean(existingProfileName) &&
      Boolean(detectedName) &&
      !namesReasonablyMatch(existingProfileName, detectedName);

    if (previewOnly) {
      return json(200, {
        ok: true,
        preview_only: true,
        prefill: {
          candidate_email: lookupEmail,
          candidate_name: detectedName,
          target_role: previewRole,
        },
        candidate_already_exists: Boolean(existingCandidateUserId),
        existing_candidate_user_id: existingCandidateUserId,
        existing_candidate_public_token: existingCandidatePublicToken,
        existing_candidate_name: existingProfileName,
        identity_name_mismatch: identityNameMismatch,
        parsing: {
          status: "preview_ready",
          warnings: previewWarnings,
          extracted: previewParsed?.structured || {},
        },
        user_message: existingCandidateUserId
          ? "Hemos detectado que el email ya existe. La importación se mantendrá en staging y no sobrescribirá el perfil."
          : "CV analizado. Revisa el prefill antes de enviar la solicitud.",
      });
    }

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

    const inviteInsert = await admin
      .from("company_candidate_import_invites")
      .insert({
        id: inviteId,
        company_id: companyId,
        invited_by_user_id: user.id,
        linked_user_id: existingCandidateUserId,
        candidate_email: lookupEmail,
        candidate_name_raw: candidateNameToPersist || null,
        target_role: targetRole,
        source: "company_cv_upload",
        source_notes: sourceNotes,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        original_filename: safeFilename(file.name || "cv"),
        mime_type: file.type,
        size_bytes: file.size,
        cv_sha256: cvHash,
        parse_status: "import_pending",
        invite_token: inviteToken,
        status: "uploaded",
        email_delivery_status: "pending",
        extracted_payload_json: {
          _verijob_import_meta: {
            candidate_already_exists: Boolean(existingCandidateUserId),
            existing_candidate_user_id: existingCandidateUserId,
            existing_candidate_public_token: existingCandidatePublicToken,
            existing_candidate_name: existingProfileName,
            identity_name_mismatch: identityNameMismatch,
            detected_candidate_email: lookupEmail,
            detected_candidate_name: detectedName,
            detected_target_role: previewRole,
            processing_mode: "background_job",
          },
        },
        extracted_warnings: [],
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
    const createdInvite = inviteInsert.data;

    const appUrl = normalizeText(process.env.NEXT_PUBLIC_APP_URL) || "https://app.verijob.es";
    const acceptanceLink = `${appUrl.replace(/\/$/, "")}/company-candidate-import/${inviteToken}`;

    after(async () => {
      try {
        await dispatchBackgroundJob({
          origin: new URL(request.url).origin,
          jobType: "company_candidate_import",
          jobId: inviteId,
        });
      } catch {
        // The invite stays in import_pending/pending and can be retried by the internal runner.
      }
    });

    return json(200, {
      ok: true,
      import_invite: (() => {
        const normalizedInvite = {
          ...createdInvite,
          candidate_already_exists: Boolean(existingCandidateUserId),
          candidate_public_token: existingCandidatePublicToken,
          candidate_email: lookupEmail,
        };
        return {
          ...normalizedInvite,
      display_status: formatImportStatus(normalizedInvite),
        };
      })(),
      user_message: existingCandidateUserId
        ? "CV recibido. Candidato existente detectado por email. La importación quedará en staging para revisión, sin sobrescribir su perfil."
        : "CV recibido. Estamos procesando la importación y preparando una propuesta de cambios para el candidato.",
      acceptance_link: acceptanceLink,
      candidate_already_exists: Boolean(existingCandidateUserId),
      existing_candidate_user_id: existingCandidateUserId,
      existing_candidate_public_token: existingCandidatePublicToken,
      identity_name_mismatch: identityNameMismatch,
      parsing: {
        status: "import_pending",
        warnings: previewWarnings,
      },
      email: {
        ok: false,
        status: "pending",
        error: null,
      },
      processing: {
        deferred: true,
        invite_id: inviteId,
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
    if (!["set_stage", "delete_import"].includes(action)) {
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

    const nowIso = new Date().toISOString();

    if (action === "delete_import") {
      const { error: deleteErr } = await admin
        .from("company_candidate_import_invites")
        .delete()
        .eq("id", inviteId)
        .eq("company_id", companyId);

      if (deleteErr) {
        return json(400, {
          error: "company_candidate_import_invite_delete_failed",
          details: deleteErr.message,
          user_message: "No se pudo eliminar la importación.",
        });
      }

      return json(200, {
        ok: true,
        invite_id: inviteId,
        deleted: true,
        user_message: "Importación eliminada.",
      });
    }

    const currentPayload =
      inviteRow?.extracted_payload_json && typeof inviteRow.extracted_payload_json === "object"
        ? inviteRow.extracted_payload_json
        : {};
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
          : nextStage === "archived"
            ? "Importación archivada."
          : nextStage === "saved"
            ? "Candidato guardado en tu base interna."
            : "Estado interno eliminado.",
    });
  } catch (error: any) {
    return json(500, { error: "unhandled_exception", details: String(error?.message || error) });
  }
}
