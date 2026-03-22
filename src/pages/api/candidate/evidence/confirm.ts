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
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";

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
    if (origin) {
      void import("@/lib/jobs/background-processing")
        .then(({ dispatchBackgroundJob }) =>
          dispatchBackgroundJob({
            origin,
            jobType: "evidence_processing",
            jobId: String(evidence.id),
          })
        )
        .catch(() => {});
    }

    return json(res, 200, {
      ok: true,
      evidence: { id: evidence.id },
      verification_request_id: verificationRequestId,
      employment_record_id: verificationRequest.employment_record_id ?? null,
      documentary_processing: processingState,
      processing: {
        deferred: true,
        evidence_id: evidence.id,
        status: "queued",
      },
    });
  } catch (error: any) {
    console.error("EVIDENCE_CONFIRM_FAILED", error);
    return json(res, 500, {
      error: "internal_error",
      details: String(error?.message || error || "unknown_error"),
    });
  }
}
