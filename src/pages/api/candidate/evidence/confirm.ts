import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";
import {
  getEvidenceTypeConfig,
  EVIDENCE_VALIDATION_INTERNAL,
  normalizeEvidenceType,
} from "@/lib/candidate/evidence-types";
import {
  buildProcessingReference,
  dispatchBackgroundJob,
  resolveOriginFromNodeRequest,
} from "@/lib/jobs/background-processing";

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function isHexSha256(s?: string) {
  if (!s) return true;
  return /^[a-f0-9]{64}$/i.test(s);
}

function messageIncludes(error: any, value: string) {
  const text = String(error?.message || error?.details || error || "").toLowerCase();
  return text.includes(value.toLowerCase());
}

function omitColumn(row: Record<string, any>, columnName: string) {
  const next = { ...row };
  delete next[columnName];
  return next;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed", route: "/pages/api/candidate/evidence/confirm" });
  }

  try {
    const supabase = createPagesRouteClient(req, res);
    const admin = createServiceRoleClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();

    if (authErr || !auth?.user) {
      return json(res, 401, {
        error: "No autenticado",
        route: "/pages/api/candidate/evidence/confirm",
        details: authErr?.message ?? null,
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const verification_request_id = String(body?.verification_request_id ?? "").trim();
    const storage_path = String(body?.storage_path ?? "").trim();
    const evidence_type = normalizeEvidenceType(body?.evidence_type);
    const evidenceConfig = getEvidenceTypeConfig(evidence_type);
    const file_sha256 = body?.file_sha256 ? String(body.file_sha256).toLowerCase() : null;
    const storage_bucket = String(body?.storage_bucket || "evidence").trim() || "evidence";
    const original_filename = String(body?.original_filename || "").trim() || null;
    const mime_type = String(body?.mime || body?.mime_type || "").trim() || null;
    const size_bytes = Number(body?.size_bytes ?? 0) || null;

    if (!verification_request_id) {
      return json(res, 400, { error: "Falta verification_request_id", route: "/pages/api/candidate/evidence/confirm" });
    }
    if (!storage_path) {
      return json(res, 400, { error: "Falta storage_path", route: "/pages/api/candidate/evidence/confirm" });
    }
    if (!isHexSha256(file_sha256 ?? undefined)) {
      return json(res, 400, {
        error: "file_sha256 debe ser hex SHA-256 (64 chars) si se envía",
        route: "/pages/api/candidate/evidence/confirm",
      });
    }

    const { data: vr, error: vrErr } = await supabase
      .from("verification_requests")
      .select("id, company_id, employment_record_id, requested_by, request_context")
      .eq("id", verification_request_id)
      .maybeSingle();

    if (vrErr) {
      return json(res, 400, {
        error: "Error consultando verification_requests",
        route: "/pages/api/candidate/evidence/confirm",
        details: vrErr.message,
      });
    }
    if (!vr || String((vr as any)?.requested_by || "") !== auth.user.id) {
      return json(res, 404, {
        error: "verification_request no encontrada o sin acceso",
        route: "/pages/api/candidate/evidence/confirm",
      });
    }

    const row: Record<string, any> = {
      verification_request_id,
      storage_bucket,
      storage_path,
      original_filename,
      mime_type,
      size_bytes,
      evidence_type,
      document_type: evidence_type,
      document_scope: evidenceConfig.scope,
      trust_weight: evidenceConfig.trustWeight,
      validation_status: EVIDENCE_VALIDATION_INTERNAL.UPLOADED,
      inconsistency_reason: null,
      document_issue_date: null,
      uploaded_by: auth.user.id,
      file_sha256,
    };

    let insertPayload: Record<string, any> = { ...row };
    let insertResult = await admin
      .from("evidences")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertResult.error && messageIncludes(insertResult.error, `column "storage_bucket"`)) {
      insertPayload = omitColumn(insertPayload, "storage_bucket");
      insertResult = await admin
        .from("evidences")
        .insert(insertPayload)
        .select("id")
        .single();
    }
    if (insertResult.error && messageIncludes(insertResult.error, `column "original_filename"`)) {
      insertPayload = omitColumn(insertPayload, "original_filename");
      insertResult = await admin
        .from("evidences")
        .insert(insertPayload)
        .select("id")
        .single();
    }
    if (insertResult.error && messageIncludes(insertResult.error, `column "mime_type"`)) {
      insertPayload = omitColumn(insertPayload, "mime_type");
      insertResult = await admin
        .from("evidences")
        .insert(insertPayload)
        .select("id")
        .single();
    }
    if (insertResult.error && messageIncludes(insertResult.error, `column "size_bytes"`)) {
      insertPayload = omitColumn(insertPayload, "size_bytes");
      insertResult = await admin
        .from("evidences")
        .insert(insertPayload)
        .select("id")
        .single();
    }

    const { data, error } = insertResult;

    if (error) {
      return json(res, 400, {
        error: "No se pudo registrar la evidencia en DB",
        route: "/pages/api/candidate/evidence/confirm",
        details: error.message,
      });
    }

    trackEventAdmin({
      event_name: "evidence_uploaded",
      user_id: auth.user.id,
      company_id: vr.company_id ?? null,
      entity_type: "evidence",
      entity_id: data.id,
      metadata: {
        verification_request_id,
        storage_path,
        evidence_type,
        file_sha256,
      },
    }).catch(() => {});

    await admin
      .from("evidences")
      .update({ validation_status: EVIDENCE_VALIDATION_INTERNAL.AUTO_PROCESSING })
      .eq("id", data.id)
      .eq("uploaded_by", auth.user.id);
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
      queue_reference: buildProcessingReference(`${data.id}:${verification_request_id}`),
    };

    const previousContext =
      (vr as any)?.request_context && typeof (vr as any).request_context === "object"
        ? (vr as any).request_context
        : {};

    await admin
      .from("verification_requests")
      .update({
        request_context: {
          ...previousContext,
          documentary_processing: processingState,
        },
      })
      .eq("id", verification_request_id);

    const origin = resolveOriginFromNodeRequest(req);
    if (origin) {
      void dispatchBackgroundJob({
        origin,
        jobType: "evidence_processing",
        jobId: String(data.id),
      }).catch(() => {});
    }

    return json(res, 200, {
      ok: true,
      evidence: data,
      documentary_processing: processingState,
      processing: {
        deferred: true,
        evidence_id: data.id,
        status: "queued",
      },
      route: "/pages/api/candidate/evidence/confirm",
    });
  } catch (e: any) {
    return json(res, 500, {
      error: "server_error",
      route: "/pages/api/candidate/evidence/confirm",
      details: String(e?.message || e),
    });
  }
}
