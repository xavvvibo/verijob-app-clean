import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";
import {
  EVIDENCE_VALIDATION_INTERNAL,
  getEvidenceTypeConfig,
  normalizeEvidenceType,
} from "@/lib/candidate/evidence-types";
import { dispatchBackgroundJob } from "@/lib/jobs/background-processing";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";
import { validateEvidenceFileMeta } from "@/lib/candidate/file-validation";

const ROUTE = "/pages/api/candidate/evidence/confirm";

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ ...body, route: ROUTE });
}

function isHexSha256(value?: string) {
  if (!value) return true;
  return /^[a-f0-9]{64}$/i.test(value);
}

function buildProcessingReference(seed: string) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

function resolveOriginFromNodeRequest(req: NextApiRequest) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0]?.trim() || "https";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0]?.trim();
  if (!host) return null;
  return `${proto}://${host}`;
}

function buildEvidenceInsertPayload(body: {
  verification_request_id: string;
  storage_path: string;
  storage_bucket?: string;
  original_filename?: string;
  mime?: string;
  size_bytes?: number | null;
  evidence_type: string;
  file_sha256?: string;
  uploaded_by: string;
}) {
  const evidenceType = normalizeEvidenceType(body.evidence_type);
  const evidenceConfig = getEvidenceTypeConfig(evidenceType);

  return {
    verification_request_id: body.verification_request_id,
    storage_bucket: String(body.storage_bucket || "evidence").trim() || "evidence",
    storage_path: body.storage_path,
    original_filename: body.original_filename || null,
    mime_type: body.mime || null,
    size_bytes: Number.isFinite(Number(body.size_bytes)) ? Number(body.size_bytes) : null,
    evidence_type: evidenceType,
    document_type: evidenceType,
    document_scope: evidenceConfig.scope,
    trust_weight: evidenceConfig.trustWeight,
    validation_status: EVIDENCE_VALIDATION_INTERNAL.AUTO_PROCESSING,
    inconsistency_reason: null,
    document_issue_date: null,
    uploaded_by: body.uploaded_by,
    file_sha256: body.file_sha256 || createHash("sha256").update(body.storage_path).digest("hex"),
  };
}

async function insertEvidenceResilient(admin: any, payload: Record<string, any>) {
  const attempts: Array<Record<string, any>> = [
    payload,
    (() => {
      const rest = { ...payload };
      delete rest.storage_bucket;
      delete rest.original_filename;
      delete rest.mime_type;
      delete rest.size_bytes;
      return rest;
    })(),
  ];

  let lastError: any = null;
  for (const attempt of attempts) {
    const { data, error } = await admin.from("evidences").insert(attempt).select("id").single();
    if (!error && data?.id) return { data, error: null };
    lastError = error;
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("column")) break;
  }

  return { data: null, error: lastError };
}

async function persistDispatchFailure(params: {
  admin: any;
  verificationRequestId: string;
  previousContext: Record<string, any>;
  processingState: Record<string, any>;
  errorMessage: string;
}) {
  const failedProcessing = {
    ...params.processingState,
    status: "failed",
    processing_status: "failed",
    processed_at: new Date().toISOString(),
    retryable: true,
    processing_summary: "No pudimos iniciar el análisis automático.",
    error: params.errorMessage,
    overall_match_level: "inconclusive",
  };

  await params.admin
    .from("verification_requests")
    .update({
      request_context: {
        ...params.previousContext,
        documentary_processing: failedProcessing,
      },
    })
    .eq("id", params.verificationRequestId);

  return failedProcessing;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }

    const supabase = createPagesRouteClient(req, res);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json(res, 401, { error: "unauthorized", details: authError?.message || null });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const verificationRequestId = String(body?.verification_request_id || "").trim();
    const storagePath = String(body?.storage_path || "").trim();
    const evidenceType = String(body?.evidence_type || "").trim();
    const fileSha256 = String(body?.file_sha256 || "").trim();
    const storageBucket = String(body?.storage_bucket || "evidence").trim() || "evidence";
    const originalFilename = String(body?.original_filename || "").trim() || null;
    const mime = String(body?.mime || "").trim() || null;
    const sizeBytes = body?.size_bytes == null ? null : Number(body.size_bytes);

    if (!verificationRequestId || !storagePath || !evidenceType) {
      return json(res, 400, {
        error: "missing_required_fields",
        details: "verification_request_id, storage_path y evidence_type son obligatorios.",
      });
    }

    if (!isHexSha256(fileSha256 || undefined)) {
      return json(res, 400, { error: "invalid_file_sha256" });
    }
    const fileValidation = validateEvidenceFileMeta({
      filename: originalFilename,
      mime,
      sizeBytes,
      maxSizeBytes: 20 * 1024 * 1024,
    });
    if (!fileValidation.ok) {
      return json(res, 400, { error: fileValidation.code, details: fileValidation.message });
    }

    const { data: verificationRequest, error: verificationRequestError } = await supabase
      .from("verification_requests")
      .select("id,requested_by,company_id,employment_record_id,request_context")
      .eq("id", verificationRequestId)
      .maybeSingle();

    if (verificationRequestError) {
      return json(res, 400, {
        error: "verification_request_lookup_failed",
        details: verificationRequestError.message,
      });
    }

    if (!verificationRequest?.id) {
      return json(res, 404, { error: "verification_request_not_found" });
    }

    if (String(verificationRequest.requested_by || "") !== String(user.id)) {
      return json(res, 403, { error: "ownership_mismatch" });
    }

    const admin = createServiceRoleClient() as any;
    const evidenceInsert = buildEvidenceInsertPayload({
      verification_request_id: verificationRequestId,
      storage_path: storagePath,
      storage_bucket: storageBucket,
      original_filename: originalFilename || undefined,
      mime: mime || undefined,
      size_bytes: Number.isFinite(sizeBytes as number) ? sizeBytes : null,
      evidence_type: evidenceType,
      file_sha256: fileSha256 || undefined,
      uploaded_by: user.id,
    });

    const { data: evidence, error: evidenceError } = await insertEvidenceResilient(admin, evidenceInsert);
    if (evidenceError || !evidence?.id) {
      return json(res, 400, {
        error: "evidence_insert_failed",
        details: evidenceError?.message || "No se pudo registrar la evidencia.",
      });
    }
    console.info("EVIDENCE_CONFIRM_CREATED", {
      evidenceId: evidence.id,
      verificationRequestId,
      uploadedBy: user.id,
      evidenceType: evidenceInsert.evidence_type,
      storagePath,
    });

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
      queue_reference: buildProcessingReference(`${evidence.id}:${verificationRequestId}`),
    };

    const previousContext =
      verificationRequest.request_context && typeof verificationRequest.request_context === "object"
        ? verificationRequest.request_context
        : {};

    const { error: verificationUpdateError } = await admin
      .from("verification_requests")
      .update({
        request_context: {
          ...previousContext,
          documentary_processing: processingState,
        },
      })
      .eq("id", verificationRequestId);

    if (verificationUpdateError) {
      return json(res, 400, {
        error: "verification_request_update_failed",
        details: verificationUpdateError.message,
        evidence_id: evidence.id,
      });
    }

    await recalculateAndPersistCandidateTrustScore(user.id).catch(() => {});

    trackEventAdmin({
      event_name: "evidence_uploaded",
      user_id: user.id,
      company_id: verificationRequest.company_id ?? null,
      entity_type: "evidence",
      entity_id: evidence.id,
      metadata: {
        verification_request_id: verificationRequestId,
        storage_path: storagePath,
        evidence_type: evidenceInsert.evidence_type,
      },
    }).catch(() => {});

    const origin = resolveOriginFromNodeRequest(req);
    let dispatchResult: Awaited<ReturnType<typeof dispatchBackgroundJob>> | null = null;
    let responseProcessingState: Record<string, any> = processingState;
    if (origin) {
      try {
        dispatchResult = await dispatchBackgroundJob({
          origin,
          jobType: "evidence_processing",
          jobId: String(evidence.id),
        });
        console.info("EVIDENCE_CONFIRM_DISPATCH_RESULT", {
          evidenceId: evidence.id,
          mode: dispatchResult.mode,
          ok: dispatchResult.ok,
          status: dispatchResult.status,
          details: dispatchResult.details || null,
          error: dispatchResult.error || null,
        });
        if (!dispatchResult.ok) {
          responseProcessingState = await persistDispatchFailure({
            admin,
            verificationRequestId,
            previousContext,
            processingState,
            errorMessage: dispatchResult.error || dispatchResult.details || "background_dispatch_failed",
          });
        }
      } catch (dispatchError: any) {
        const dispatchMessage = String(dispatchError?.message || dispatchError || "background_dispatch_failed");
        console.error("EVIDENCE_CONFIRM_DISPATCH_EXCEPTION", {
          evidenceId: evidence.id,
          error: dispatchMessage,
        });
        dispatchResult = {
          ok: false,
          mode: "inline",
          status: 500,
          details: "dispatch_exception",
          error: dispatchMessage,
        };
        responseProcessingState = await persistDispatchFailure({
          admin,
          verificationRequestId,
          previousContext,
          processingState,
          errorMessage: dispatchMessage,
        });
      }
    } else {
      console.error("EVIDENCE_CONFIRM_DISPATCH_SKIPPED", {
        evidenceId: evidence.id,
        reason: "missing_origin",
      });
      dispatchResult = {
        ok: false,
        mode: "inline",
        status: 500,
        details: "missing_origin",
        error: "missing_origin",
      };
      responseProcessingState = await persistDispatchFailure({
        admin,
        verificationRequestId,
        previousContext,
        processingState,
        errorMessage: "missing_origin",
      });
    }

    const responseBody = {
      ok: true,
      evidence: { id: evidence.id },
      verification_request_id: verificationRequestId,
      employment_record_id: verificationRequest.employment_record_id ?? null,
      documentary_processing: responseProcessingState,
      processing: {
        deferred: dispatchResult?.mode === "remote" && dispatchResult?.ok === true,
        evidence_id: evidence.id,
        status: responseProcessingState.processing_status || responseProcessingState.status || "queued",
      },
      processing_dispatched: Boolean(dispatchResult?.ok),
      processing_error: dispatchResult?.ok ? null : dispatchResult?.error || dispatchResult?.details || "background_dispatch_failed",
      dispatch: dispatchResult,
    };
    if (dispatchResult?.ok) {
      console.info("EVIDENCE_CONFIRM_RESPONSE_OK", {
        evidenceId: evidence.id,
        processingStatus: responseBody.processing.status,
      });
    } else {
      console.error("EVIDENCE_CONFIRM_RESPONSE_PARTIAL", {
        evidenceId: evidence.id,
        processingStatus: responseBody.processing.status,
        processingError: responseBody.processing_error,
      });
    }
    return json(res, 200, responseBody);
  } catch (error: any) {
    console.error("EVIDENCE_CONFIRM_FAILED", error);
    console.error("EVIDENCE_CONFIRM_RESPONSE_FATAL", {
      error: String(error?.message || error || "unknown_error"),
    });
    return json(res, 500, {
      error: "internal_error",
      details: String(error?.message || error || "unknown_error"),
    });
  }
}
