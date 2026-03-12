import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";
import {
  buildEmploymentRecordDocumentaryPendingReviewUpdate,
  buildEmploymentRecordDocumentaryResolvedUpdate,
} from "@/lib/candidate/documentary-flow";
import {
  computeDocumentaryMatching,
  extractDocumentarySignals,
} from "@/lib/candidate/documentary-processing";
import { extractCvTextFromBuffer } from "@/utils/cv/extractText";
import {
  getEvidenceTypeConfig,
  EVIDENCE_VALIDATION_INTERNAL,
  normalizeEvidenceType,
  normalizeValidationStatus,
} from "@/lib/candidate/evidence-types";

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function isHexSha256(s?: string) {
  if (!s) return true;
  return /^[a-f0-9]{64}$/i.test(s);
}

function normalizeDateOnly(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed", route: "/pages/api/candidate/evidence/confirm" });
  }

  try {
    const supabase = createPagesRouteClient(req, res);
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

    const row = {
      verification_request_id,
      storage_path,
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

    const { data, error } = await supabase
      .from("evidences")
      .insert(row)
      .select("id, verification_request_id, storage_path, evidence_type, document_type, document_scope, trust_weight, validation_status, inconsistency_reason, document_issue_date, uploaded_by, created_at, file_sha256")
      .single();

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

    await supabase
      .from("evidences")
      .update({ validation_status: EVIDENCE_VALIDATION_INTERNAL.AUTO_PROCESSING })
      .eq("id", data.id)
      .eq("uploaded_by", auth.user.id);

    const evidenceMime =
      storage_path.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : storage_path.toLowerCase().endsWith(".jpg") || storage_path.toLowerCase().endsWith(".jpeg")
          ? "image/jpeg"
          : storage_path.toLowerCase().endsWith(".png")
            ? "image/png"
            : storage_path.toLowerCase().endsWith(".webp")
              ? "image/webp"
              : "application/octet-stream";

    const processingStartedAt = new Date().toISOString();
    let documentaryProcessing: any = {
      mode: "evidence",
      processor: "responses_api_file_input",
      processing_started_at: processingStartedAt,
      link_state: "suggested_review",
      needs_manual_review: true,
      extraction: null,
      matching: null,
      error: null,
      fallback_text_mode: false,
    };
    let finalValidationStatus = EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW;
    let finalInconsistencyReason: string | null = null;
    let finalDocumentIssueDate: string | null = null;

    try {
      const { data: fileBlob, error: downloadErr } = await supabase.storage
        .from("evidence")
        .download(storage_path);

      if (downloadErr || !fileBlob) {
        throw new Error(`evidence_download_failed:${downloadErr?.message || "missing_blob"}`);
      }

      const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
      const fileName = String(storage_path.split("/").pop() || "evidence_document");
      const openaiKey =
        process.env.OPENAI_API_KEY ||
        process.env.OPEN_API_KEY ||
        process.env.OPENAI_KEY ||
        null;

      if (!openaiKey) throw new Error("missing_openai_api_key");

      const [{ data: employmentRows }, { data: profileRow }] = await Promise.all([
        supabase
          .from("employment_records")
          .select("id,position,company_name_freeform,start_date,end_date")
          .eq("candidate_id", auth.user.id),
        supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
      ]);

      const extractionResult = await extractDocumentarySignals({
        fileBuffer,
        fileName,
        mimeType: evidenceMime,
        openaiApiKey: openaiKey,
        textFallbackExtractor: extractCvTextFromBuffer,
      });

      const matching = computeDocumentaryMatching({
        extraction: extractionResult.extraction,
        employmentRecords: Array.isArray(employmentRows) ? employmentRows : [],
        candidateName: (profileRow as any)?.full_name || null,
      });

      documentaryProcessing = {
        ...documentaryProcessing,
        extraction: extractionResult.extraction,
        matching,
        link_state: matching.link_state,
        needs_manual_review: matching.needs_manual_review,
        matching_reason: matching.matching_reason,
        inconsistency_reason: matching.inconsistency_reason || null,
        fallback_text_mode: Boolean(extractionResult.fallbackTextUsed),
        warning: extractionResult.warning || null,
        provider: extractionResult.provider,
        model: extractionResult.model,
        evidence_type: evidence_type,
        trust_weight: evidenceConfig.trustWeight,
        evidence_scope: evidenceConfig.scope,
      };
      finalValidationStatus = matching.auto_link
        ? EVIDENCE_VALIDATION_INTERNAL.APPROVED
        : matching.inconsistency_reason
          ? EVIDENCE_VALIDATION_INTERNAL.REJECTED
          : EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW;
      finalInconsistencyReason = matching.inconsistency_reason || null;
      finalDocumentIssueDate = normalizeDateOnly(extractionResult?.extraction?.issue_date);

      const bestMatchId = String(matching?.best_match?.employment_record_id || "").trim() || null;
      const currentEmploymentRecordId = String((vr as any)?.employment_record_id || "").trim() || null;
      const linkedEmploymentRecordId =
        matching.auto_link && bestMatchId ? bestMatchId : currentEmploymentRecordId;

      if (matching.auto_link && linkedEmploymentRecordId) {
        if (linkedEmploymentRecordId !== currentEmploymentRecordId) {
          await supabase
            .from("verification_requests")
            .update({
              employment_record_id: linkedEmploymentRecordId,
            })
            .eq("id", verification_request_id);
        }

        const employmentUpdate = buildEmploymentRecordDocumentaryResolvedUpdate({
          verificationRequestId: verification_request_id,
          nowIso: new Date().toISOString(),
        });
        await supabase
          .from("employment_records")
          .update(employmentUpdate)
          .eq("id", linkedEmploymentRecordId)
          .eq("candidate_id", auth.user.id);
      } else if (currentEmploymentRecordId) {
        const pendingUpdate = buildEmploymentRecordDocumentaryPendingReviewUpdate({
          verificationRequestId: verification_request_id,
          nowIso: new Date().toISOString(),
        });
        await supabase
          .from("employment_records")
          .update(pendingUpdate)
          .eq("id", currentEmploymentRecordId)
          .eq("candidate_id", auth.user.id);
      }
    } catch (processingError: any) {
      documentaryProcessing = {
        ...documentaryProcessing,
        link_state: "suggested_review",
        needs_manual_review: true,
        error: String(processingError?.message || processingError),
        evidence_type: evidence_type,
        trust_weight: evidenceConfig.trustWeight,
        evidence_scope: evidenceConfig.scope,
      };
      finalValidationStatus = EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW;
      finalInconsistencyReason = null;
      console.error("documentary evidence processing failed", {
        verification_request_id,
        storage_path,
        error: documentaryProcessing.error,
      });
    }

    const previousContext =
      (vr as any)?.request_context && typeof (vr as any).request_context === "object"
        ? (vr as any).request_context
        : {};
    const nextContext = {
      ...previousContext,
      documentary_processing: {
        ...documentaryProcessing,
        processed_at: new Date().toISOString(),
      },
    };

    await supabase
      .from("verification_requests")
      .update({ request_context: nextContext })
      .eq("id", verification_request_id);

    await supabase
      .from("evidences")
      .update({
        document_type: evidence_type,
        document_scope: evidenceConfig.scope,
        trust_weight: evidenceConfig.trustWeight,
        validation_status: normalizeValidationStatus(finalValidationStatus),
        inconsistency_reason: finalInconsistencyReason,
        document_issue_date: finalDocumentIssueDate,
      })
      .eq("id", data.id)
      .eq("uploaded_by", auth.user.id);

    await recalculateAndPersistCandidateTrustScore(auth.user.id).catch(() => {});

    return json(res, 200, {
      ok: true,
      evidence: data,
      documentary_processing: documentaryProcessing,
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
