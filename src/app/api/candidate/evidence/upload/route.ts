import { NextResponse } from "next/server";
import { randomUUID, createHash } from "crypto";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";
import {
  buildDocumentaryVerificationInsert,
  buildEmploymentRecordDocumentaryRequestedUpdate,
  getActiveDocumentaryVerificationId,
} from "@/lib/candidate/documentary-flow";
import {
  EVIDENCE_VALIDATION_INTERNAL,
  getEvidenceTypeConfig,
  normalizeEvidenceType,
  requiresExperienceAssociation,
} from "@/lib/candidate/evidence-types";
import {
  buildProcessingReference,
  dispatchBackgroundJob,
} from "@/lib/jobs/background-processing";
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "evidence";
const MAX_MB = 20;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function json(status: number, body: any) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function safeFilename(name: string) {
  const base = name.split("/").pop()?.split("\\").pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned || "file";
}

function extFromMime(mime: string, fallbackName: string) {
  const lower = fallbackName.toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  const m = lower.match(/\.([a-z0-9]{2,5})$/);
  return m?.[1] ?? "bin";
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isHexSha256(s?: string) {
  if (!s) return true;
  return /^[a-f0-9]{64}$/i.test(s);
}

async function ensureEvidenceBucket(admin: any) {
  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_MB}MB`,
    allowedMimeTypes: Array.from(ALLOWED_MIME),
  });
  if (!error) return null;
  const message = String(error.message || "").toLowerCase();
  if (message.includes("already exists") || message.includes("duplicate") || message.includes("exists")) {
    return null;
  }
  return error;
}

async function materializeEmploymentRecordFromProfileExperience(params: {
  admin: any;
  userId: string;
  profileExperienceId: string;
}) {
  const { data: profileExperience, error: profileExperienceErr } = await params.admin
    .from("profile_experiences")
    .select("id,role_title,company_name,start_date,end_date,user_id")
    .eq("id", params.profileExperienceId)
    .maybeSingle();
  if (profileExperienceErr) return { error: { error: "Error consultando profile_experiences", details: profileExperienceErr.message } };
  if (!profileExperience || String((profileExperience as any).user_id || "") !== params.userId) {
    return { error: { error: "profile_experience no encontrada o sin acceso" } };
  }

  const insertPayload: Record<string, any> = {
    candidate_id: params.userId,
    position: (profileExperience as any)?.role_title || null,
    company_name_freeform: (profileExperience as any)?.company_name || null,
    start_date: (profileExperience as any)?.start_date || null,
    end_date: (profileExperience as any)?.end_date || null,
    verification_status: "unverified",
    source_experience_id: String((profileExperience as any)?.id || ""),
  };

  let createdEmployment: any = null;
  let createdEmploymentError: any = null;

  const primaryInsert = await params.admin.from("employment_records").insert(insertPayload).select("id").single();
  createdEmployment = primaryInsert.data;
  createdEmploymentError = primaryInsert.error;

  if (createdEmploymentError && /source_experience_id/i.test(String(createdEmploymentError?.message || ""))) {
    const fallbackInsertPayload = { ...insertPayload };
    delete fallbackInsertPayload.source_experience_id;
    const fallbackInsert = await params.admin
      .from("employment_records")
      .insert(fallbackInsertPayload)
      .select("id")
      .single();
    createdEmployment = fallbackInsert.data;
    createdEmploymentError = fallbackInsert.error;
  }

  if (createdEmploymentError || !createdEmployment?.id) {
    return { error: { error: "No se pudo crear employment_record para la evidencia", details: createdEmploymentError?.message || null } };
  }

  return { employmentRecordId: String(createdEmployment.id) };
}

async function resolveDocumentaryContext(args: {
  admin: any;
  supabase: any;
  userId: string;
  evidenceType: string;
  employmentRecordRef: string;
  verificationRequestId: string;
}) {
  let resolvedVerificationRequestId = args.verificationRequestId;
  let resolvedEmploymentRecordId = args.employmentRecordRef.startsWith("profile:") ? "" : args.employmentRecordRef;
  const resolvedProfileExperienceId = args.employmentRecordRef.startsWith("profile:")
    ? args.employmentRecordRef.replace(/^profile:/, "").trim()
    : "";

  if (resolvedEmploymentRecordId && !isUuid(resolvedEmploymentRecordId)) {
    return { error: { error: "employment_record_id inválido" } };
  }
  if (resolvedProfileExperienceId && !isUuid(resolvedProfileExperienceId)) {
    return { error: { error: "profile_experience_id inválido" } };
  }

  if (!resolvedEmploymentRecordId && resolvedProfileExperienceId) {
    const materialized = await materializeEmploymentRecordFromProfileExperience({
      admin: args.admin,
      userId: args.userId,
      profileExperienceId: resolvedProfileExperienceId,
    });
    if ((materialized as any).error) return materialized;
    resolvedEmploymentRecordId = String((materialized as any).employmentRecordId || "");
  }

  if (resolvedEmploymentRecordId) {
    const { data: er, error: erErr } = await args.supabase
      .from("employment_records")
      .select("id,candidate_id,company_name_freeform,position")
      .eq("id", resolvedEmploymentRecordId)
      .maybeSingle();
    if (erErr) return { error: { error: "Error consultando employment_records", details: erErr.message } };
    if (!er || String((er as any).candidate_id || "") !== args.userId) {
      return { error: { error: "employment_record no encontrado o sin acceso" } };
    }

    if (!resolvedVerificationRequestId) {
      const activeQuery = args.supabase
        .from("verification_requests")
        .select("id")
        .eq("requested_by", args.userId)
        .eq("employment_record_id", resolvedEmploymentRecordId)
        .eq("verification_channel", "documentary")
        .neq("status", "revoked")
        .or("external_resolved.is.null,external_resolved.eq.false")
        .order("created_at", { ascending: false })
        .limit(1);

      const { data: existingRows, error: existingErr } = await activeQuery;
      if (existingErr) {
        if (!isMissingExternalResolvedColumn(existingErr)) {
          return { error: { error: "Error consultando verification_requests activas", details: existingErr.message } };
        }
        const fallback = await args.supabase
          .from("verification_requests")
          .select("id,status,resolved_at,created_at")
          .eq("requested_by", args.userId)
          .eq("employment_record_id", resolvedEmploymentRecordId)
          .eq("verification_channel", "documentary")
          .neq("status", "revoked")
          .order("created_at", { ascending: false })
          .limit(10);
        if (fallback.error) {
          return { error: { error: "Error consultando verification_requests activas", details: fallback.error.message } };
        }
        const activeFallbackRows = (Array.isArray(fallback.data) ? fallback.data : []).filter(
          (row: any) => !isVerificationExternallyResolved(row),
        );
        const activeDocumentaryId = getActiveDocumentaryVerificationId(activeFallbackRows);
        if (activeDocumentaryId) {
          resolvedVerificationRequestId = activeDocumentaryId;
        }
      }

      const activeDocumentaryId = resolvedVerificationRequestId
        ? resolvedVerificationRequestId
        : getActiveDocumentaryVerificationId(existingRows);
      if (activeDocumentaryId) {
        resolvedVerificationRequestId = activeDocumentaryId;
      } else {
        const nowIso = new Date().toISOString();
        const payload = buildDocumentaryVerificationInsert({
          employmentRecordId: resolvedEmploymentRecordId,
          userId: args.userId,
          companyName: (er as any)?.company_name_freeform,
          position: (er as any)?.position,
          nowIso,
          documentaryScope: "experience",
          evidenceType: args.evidenceType,
        });
        const { data: createdVr, error: createVrErr } = await args.admin
          .from("verification_requests")
          .insert(payload)
          .select("id")
          .single();
        if (createVrErr || !createdVr?.id) {
          return { error: { error: "No se pudo crear verification_request documental", details: createVrErr?.message || null } };
        }
        resolvedVerificationRequestId = String(createdVr.id);
      }
    }

    const nowIso = new Date().toISOString();
    await args.supabase
      .from("employment_records")
      .update(
        buildEmploymentRecordDocumentaryRequestedUpdate({
          verificationRequestId: resolvedVerificationRequestId,
          nowIso,
        }),
      )
      .eq("id", resolvedEmploymentRecordId);
  }

  if (!resolvedVerificationRequestId && !resolvedEmploymentRecordId && !requiresExperienceAssociation(args.evidenceType)) {
    const { data: anchorEmployment } = await args.admin
      .from("employment_records")
      .select("id")
      .eq("candidate_id", args.userId)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    resolvedEmploymentRecordId = String((anchorEmployment as any)?.id || "").trim();
    if (!resolvedEmploymentRecordId) {
      const { data: profileExperience } = await args.admin
        .from("profile_experiences")
        .select("id")
        .eq("user_id", args.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (profileExperience?.id) {
        const materialized = await materializeEmploymentRecordFromProfileExperience({
          admin: args.admin,
          userId: args.userId,
          profileExperienceId: String((profileExperience as any).id),
        });
        if ((materialized as any).error) return materialized;
        resolvedEmploymentRecordId = String((materialized as any).employmentRecordId || "");
      }
    }

    if (!resolvedEmploymentRecordId) {
      return { error: { error: "Necesitas al menos una experiencia para subir esta evidencia global" } };
    }

    const nowIso = new Date().toISOString();
    const payload = buildDocumentaryVerificationInsert({
      employmentRecordId: resolvedEmploymentRecordId,
      userId: args.userId,
      companyName: "Historial laboral",
      position: "Evidencia global",
      nowIso,
      documentaryScope: "global",
      evidenceType: args.evidenceType,
    });
    const { data: createdVr, error: createVrErr } = await args.admin
      .from("verification_requests")
      .insert(payload)
      .select("id")
      .single();
    if (createVrErr || !createdVr?.id) {
      return { error: { error: "No se pudo crear verification_request documental global", details: createVrErr?.message || null } };
    }
    resolvedVerificationRequestId = String(createdVr.id);
  }

  if (!resolvedVerificationRequestId) {
    return { error: { error: "No se pudo resolver verification_request_id" } };
  }

  const { data: vr, error: vrErr } = await args.supabase
    .from("verification_requests")
    .select("id, company_id, employment_record_id, requested_by, request_context")
    .eq("id", resolvedVerificationRequestId)
    .maybeSingle();
  if (vrErr) return { error: { error: "Error consultando verification_requests", details: vrErr.message } };
  if (!vr || String((vr as any)?.requested_by || "") !== args.userId) {
    return { error: { error: "verification_request no encontrada o sin acceso" } };
  }

  return {
    verificationRequestId: resolvedVerificationRequestId,
    employmentRecordId: resolvedEmploymentRecordId || String((vr as any)?.employment_record_id || "") || null,
    verificationRequest: vr,
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return json(401, { error: "unauthorized", details: userErr?.message || null });
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const mime = String(body?.mime ?? "").trim();
      const sizeBytes = Number(body?.size_bytes ?? 0);
      const filename = safeFilename(String(body?.filename ?? "file"));
      const evidenceType = normalizeEvidenceType(body?.evidence_type);
      const evidenceConfig = getEvidenceTypeConfig(evidenceType);
      const employmentRecordRef = String(body?.employment_record_id ?? "").trim();
      const verificationRequestId = String(body?.verification_request_id ?? "").trim();
      const fileSha256 = String(body?.file_sha256 ?? "").trim().toLowerCase() || null;

      if (!ALLOWED_MIME.has(mime)) return json(400, { error: "Tipo de archivo no permitido", mime });
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return json(400, { error: "size_bytes inválido" });
      if (sizeBytes > MAX_MB * 1024 * 1024) return json(400, { error: "Archivo demasiado grande", max_mb: MAX_MB });
      if (!isHexSha256(fileSha256 || undefined)) return json(400, { error: "file_sha256 inválido" });
      if (!verificationRequestId && !employmentRecordRef && requiresExperienceAssociation(evidenceType)) {
        return json(400, { error: "Selecciona una experiencia para este tipo de documento" });
      }

      const context = await resolveDocumentaryContext({
        admin,
        supabase,
        userId: user.id,
        evidenceType,
        employmentRecordRef,
        verificationRequestId,
      });
      if ((context as any).error) return json(400, (context as any).error);

      const bucketError = await ensureEvidenceBucket(admin);
      if (bucketError) {
        return json(400, {
          error: "No se pudo preparar el almacenamiento de evidencias",
          details: bucketError.message,
          bucket: BUCKET,
        });
      }

      const storagePath = `evidence/${user.id}/${(context as any).verificationRequestId}/${randomUUID()}.${extFromMime(mime, filename)}`;
      const signed = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      if (signed.error || !signed.data?.signedUrl) {
        return json(400, {
          error: "No se pudo generar signed upload URL",
          details: signed.error?.message || null,
          bucket: BUCKET,
        });
      }

      return json(200, {
        ok: true,
        signed_url: signed.data.signedUrl,
        token: signed.data.token,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        verification_request_id: (context as any).verificationRequestId,
        employment_record_id: (context as any).employmentRecordId,
        evidence_type: evidenceType,
        evidence_type_label: evidenceConfig.label,
        original_filename: filename,
        mime,
        size_bytes: sizeBytes,
        file_sha256: fileSha256,
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const mime = String(formData.get("mime") || (file instanceof File ? file.type : "") || "").trim();
    const evidenceType = normalizeEvidenceType(formData.get("evidence_type"));
    const evidenceConfig = getEvidenceTypeConfig(evidenceType);
    const employmentRecordRef = String(formData.get("employment_record_id") || "").trim();
    const verificationRequestId = String(formData.get("verification_request_id") || "").trim();
    const fileSha256 = String(formData.get("file_sha256") || "").trim().toLowerCase() || null;

    if (!(file instanceof File)) return json(400, { error: "Selecciona un documento para subir." });
    if (!ALLOWED_MIME.has(mime)) return json(400, { error: "Tipo de archivo no permitido", mime });
    if (file.size <= 0 || file.size > MAX_MB * 1024 * 1024) {
      return json(400, { error: "Archivo demasiado grande", max_mb: MAX_MB });
    }
    if (!isHexSha256(fileSha256 || undefined)) return json(400, { error: "file_sha256 inválido" });
    if (!verificationRequestId && !employmentRecordRef && requiresExperienceAssociation(evidenceType)) {
      return json(400, { error: "Selecciona una experiencia para este tipo de documento" });
    }

    const context = await resolveDocumentaryContext({
      admin,
      supabase,
      userId: user.id,
      evidenceType,
      employmentRecordRef,
      verificationRequestId,
    });
    if ((context as any).error) return json(400, (context as any).error);

    const bucketError = await ensureEvidenceBucket(admin);
    if (bucketError) {
      return json(400, {
        error: "No se pudo preparar el almacenamiento de evidencias",
        details: bucketError.message,
        bucket: BUCKET,
      });
    }

    const filename = safeFilename(file.name || "file");
    const storagePath = `evidence/${user.id}/${(context as any).verificationRequestId}/${randomUUID()}.${extFromMime(mime, filename)}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadRes = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (uploadRes.error) {
      return json(400, {
        error: "No se pudo subir el archivo al almacenamiento",
        details: uploadRes.error.message,
        bucket: BUCKET,
      });
    }

    const evidenceRow = {
      verification_request_id: (context as any).verificationRequestId,
      storage_path: storagePath,
      evidence_type: evidenceType,
      document_type: evidenceType,
      document_scope: evidenceConfig.scope,
      trust_weight: evidenceConfig.trustWeight,
      validation_status: EVIDENCE_VALIDATION_INTERNAL.UPLOADED,
      inconsistency_reason: null,
      document_issue_date: null,
      uploaded_by: user.id,
      file_sha256: fileSha256 || createHash("sha256").update(storagePath).digest("hex"),
    };

    const { data: evidence, error: evidenceErr } = await admin
      .from("evidences")
      .insert(evidenceRow)
      .select("id")
      .single();
    if (evidenceErr || !evidence?.id) {
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return json(400, { error: "No se pudo registrar la evidencia en DB", details: evidenceErr?.message || null });
    }

    trackEventAdmin({
      event_name: "evidence_uploaded",
      user_id: user.id,
      company_id: (context as any).verificationRequest?.company_id ?? null,
      entity_type: "evidence",
      entity_id: evidence.id,
      metadata: {
        verification_request_id: (context as any).verificationRequestId,
        storage_path: storagePath,
        evidence_type: evidenceType,
      },
    }).catch(() => {});

    await admin
      .from("evidences")
      .update({ validation_status: EVIDENCE_VALIDATION_INTERNAL.AUTO_PROCESSING })
      .eq("id", evidence.id)
      .eq("uploaded_by", user.id);

    const processingState = {
      mode: "evidence",
      status: "queued",
      processor: "background_job",
      processing_started_at: new Date().toISOString(),
      link_state: "suggested_review",
      needs_manual_review: true,
      extraction: null,
      matching: null,
      error: null,
      fallback_text_mode: false,
      retryable: true,
      queue_reference: buildProcessingReference(`${evidence.id}:${(context as any).verificationRequestId}`),
    };

    const previousContext =
      (context as any)?.verificationRequest?.request_context &&
      typeof (context as any).verificationRequest.request_context === "object"
        ? (context as any).verificationRequest.request_context
        : {};

    await admin
      .from("verification_requests")
      .update({
        request_context: {
          ...previousContext,
          documentary_processing: processingState,
        },
      })
      .eq("id", (context as any).verificationRequestId);

    void dispatchBackgroundJob({
      origin: new URL(req.url).origin,
      jobType: "evidence_processing",
      jobId: String(evidence.id),
    }).catch(() => {});

    return json(200, {
      ok: true,
      evidence,
      verification_request_id: (context as any).verificationRequestId,
      employment_record_id: (context as any).employmentRecordId,
      documentary_processing: processingState,
      processing: {
        deferred: true,
        evidence_id: evidence.id,
        status: "queued",
      },
      evidence_type_label: evidenceConfig.label,
    });
  } catch (e: any) {
    return json(500, { error: "server_error", details: String(e?.message || e) });
  }
}
