import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID, createHash } from "crypto";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  buildDocumentaryVerificationInsert,
  buildEmploymentRecordDocumentaryRequestedUpdate,
  getActiveDocumentaryVerificationId,
} from "@/lib/candidate/documentary-flow";
import {
  getEvidenceTypeConfig,
  normalizeEvidenceType,
  requiresExperienceAssociation,
} from "@/lib/candidate/evidence-types";
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution";

const BUCKET = "evidence";
const MAX_MB = 20;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
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

function isHexSha256(s?: string) {
  if (!s) return true;
  return /^[a-f0-9]{64}$/i.test(s);
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed", route: "/pages/api/candidate/evidence/upload-url" });
  }

  try {
    const supabase = createPagesRouteClient(req, res);
    const admin = createServiceRoleClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();

    if (authErr || !auth?.user) {
      return json(res, 401, {
        error: "No autenticado",
        route: "/pages/api/candidate/evidence/upload-url",
        details: authErr?.message ?? null,
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const verification_request_id = String(body?.verification_request_id ?? "").trim();
    const employment_record_id = String(body?.employment_record_id ?? "").trim();
    const mime = String(body?.mime ?? "").trim();
    const size_bytes = Number(body?.size_bytes ?? 0);
    const original_name = safeFilename(String(body?.filename ?? "file"));
    const evidence_type = normalizeEvidenceType(body?.evidence_type);
    const evidenceConfig = getEvidenceTypeConfig(evidence_type);
    const file_sha256 = body?.file_sha256 ? String(body.file_sha256).toLowerCase() : null;

    if (!verification_request_id && !employment_record_id && requiresExperienceAssociation(evidence_type)) {
      return json(res, 400, {
        error: "Selecciona una experiencia para este tipo de documento",
        route: "/pages/api/candidate/evidence/upload-url",
      });
    }
    if (!ALLOWED_MIME.has(mime)) {
      return json(res, 400, { error: "Tipo de archivo no permitido", route: "/pages/api/candidate/evidence/upload-url", mime });
    }
    if (!Number.isFinite(size_bytes) || size_bytes <= 0) {
      return json(res, 400, { error: "size_bytes inválido", route: "/pages/api/candidate/evidence/upload-url" });
    }
    if (size_bytes > MAX_MB * 1024 * 1024) {
      return json(res, 400, { error: "Archivo demasiado grande", route: "/pages/api/candidate/evidence/upload-url", max_mb: MAX_MB });
    }
    if (!isHexSha256(file_sha256 ?? undefined)) {
      return json(res, 400, {
        error: "file_sha256 debe ser hex SHA-256 (64 chars) si se envía",
        route: "/pages/api/candidate/evidence/upload-url",
      });
    }

    let resolvedVerificationRequestId = verification_request_id;
    let resolvedEmploymentRecordId = employment_record_id;

    if (resolvedEmploymentRecordId && !isUuid(resolvedEmploymentRecordId)) {
      return json(res, 400, {
        error: "employment_record_id inválido",
        route: "/pages/api/candidate/evidence/upload-url",
      });
    }

    if (resolvedEmploymentRecordId) {
      const { data: er, error: erErr } = await supabase
        .from("employment_records")
        .select("id,candidate_id,company_name_freeform,position")
        .eq("id", resolvedEmploymentRecordId)
        .maybeSingle();
      if (erErr) {
        return json(res, 400, {
          error: "Error consultando employment_records",
          route: "/pages/api/candidate/evidence/upload-url",
          details: erErr.message,
        });
      }
      if (!er || String((er as any).candidate_id || "") !== auth.user.id) {
        return json(res, 404, {
          error: "employment_record no encontrado o sin acceso",
          route: "/pages/api/candidate/evidence/upload-url",
        });
      }

      if (!resolvedVerificationRequestId) {
        const activeQuery = supabase
          .from("verification_requests")
          .select("id")
          .eq("requested_by", auth.user.id)
          .eq("employment_record_id", resolvedEmploymentRecordId)
          .eq("verification_channel", "documentary")
          .neq("status", "revoked")
          .or("external_resolved.is.null,external_resolved.eq.false")
          .order("created_at", { ascending: false })
          .limit(1);

        const { data: existingRows, error: existingErr } = await activeQuery;

        if (existingErr) {
          if (!isMissingExternalResolvedColumn(existingErr)) {
            return json(res, 400, {
              error: "Error consultando verification_requests activas",
              route: "/pages/api/candidate/evidence/upload-url",
              details: existingErr.message,
            });
          }

          const fallback = await supabase
            .from("verification_requests")
            .select("id,status,resolved_at,created_at")
            .eq("requested_by", auth.user.id)
            .eq("employment_record_id", resolvedEmploymentRecordId)
            .eq("verification_channel", "documentary")
            .neq("status", "revoked")
            .order("created_at", { ascending: false })
            .limit(10);

          if (fallback.error) {
            return json(res, 400, {
              error: "Error consultando verification_requests activas",
              route: "/pages/api/candidate/evidence/upload-url",
              details: fallback.error.message,
            });
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
            userId: auth.user.id,
            companyName: (er as any)?.company_name_freeform,
            position: (er as any)?.position,
            nowIso,
            documentaryScope: "experience",
            evidenceType: evidence_type,
          });
          const { data: createdVr, error: createVrErr } = await admin
            .from("verification_requests")
            .insert(payload)
            .select("id")
            .single();
          if (createVrErr || !createdVr?.id) {
            return json(res, 400, {
              error: "No se pudo crear verification_request documental",
              route: "/pages/api/candidate/evidence/upload-url",
              details: createVrErr?.message || null,
            });
          }
          resolvedVerificationRequestId = String(createdVr.id);
        }
      }

      const nowIso = new Date().toISOString();
      const employmentUpdate = buildEmploymentRecordDocumentaryRequestedUpdate({
        verificationRequestId: resolvedVerificationRequestId,
        nowIso,
      });
      await supabase
        .from("employment_records")
        .update(employmentUpdate)
        .eq("id", resolvedEmploymentRecordId);
    }

    if (!resolvedVerificationRequestId && !resolvedEmploymentRecordId && !requiresExperienceAssociation(evidence_type)) {
      const nowIso = new Date().toISOString();
      const payload = buildDocumentaryVerificationInsert({
        employmentRecordId: null,
        userId: auth.user.id,
        companyName: "Historial laboral",
        position: "Evidencia global",
        nowIso,
        documentaryScope: "global",
        evidenceType: evidence_type,
      });
      const { data: createdVr, error: createVrErr } = await admin
        .from("verification_requests")
        .insert(payload)
        .select("id")
        .single();
      if (createVrErr || !createdVr?.id) {
        return json(res, 400, {
          error: "No se pudo crear verification_request documental global",
          route: "/pages/api/candidate/evidence/upload-url",
          details: createVrErr?.message || null,
        });
      }
      resolvedVerificationRequestId = String(createdVr.id);
    }

    if (!resolvedVerificationRequestId) {
      return json(res, 400, {
        error: "No se pudo resolver verification_request_id",
        route: "/pages/api/candidate/evidence/upload-url",
      });
    }

    const { data: vr, error: vrErr } = await supabase
      .from("verification_requests")
      .select("id,employment_record_id,requested_by")
      .eq("id", resolvedVerificationRequestId)
      .maybeSingle();

    if (vrErr) {
      return json(res, 400, {
        error: "Error consultando verification_requests",
        route: "/pages/api/candidate/evidence/upload-url",
        details: vrErr.message,
      });
    }
    if (!vr || String((vr as any).requested_by || "") !== auth.user.id) {
      return json(res, 404, {
        error: "verification_request no encontrada o sin acceso",
        route: "/pages/api/candidate/evidence/upload-url",
      });
    }

    resolvedEmploymentRecordId = resolvedEmploymentRecordId || String((vr as any).employment_record_id || "");

    const userId = auth.user.id;
    const uuid = randomUUID();
    const ext = extFromMime(mime, original_name);
    const storage_path = `evidence/${userId}/${resolvedVerificationRequestId}/${uuid}.${ext}`;
    const evidence_client_ref = createHash("sha256").update(storage_path).digest("hex").slice(0, 16);

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storage_path);

    if (error || !data?.signedUrl) {
      return json(res, 400, {
        error: "No se pudo generar signed upload URL",
        route: "/pages/api/candidate/evidence/upload-url",
        details: error?.message ?? null,
      });
    }

    return json(res, 200, {
      storage_path,
      verification_request_id: resolvedVerificationRequestId,
      employment_record_id: resolvedEmploymentRecordId || null,
      signed_url: data.signedUrl,
      token: data.token,
      mime,
      size_bytes,
      evidence_type,
      evidence_type_label: evidenceConfig.label,
      evidence_scope: evidenceConfig.scope,
      trust_weight: evidenceConfig.trustWeight,
      file_sha256,
      evidence_client_ref,
      note: "Sube el archivo usando signed_url y luego llama a POST /api/candidate/evidence/confirm para registrar evidencia y ejecutar extracción documental.",
      route: "/pages/api/candidate/evidence/upload-url",
    });
  } catch (e: any) {
    return json(res, 500, {
      error: "server_error",
      route: "/pages/api/candidate/evidence/upload-url",
      details: String(e?.message || e),
    });
  }
}
