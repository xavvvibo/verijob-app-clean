import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID, createHash } from "crypto";
import { createPagesRouteClient } from "@/utils/supabase/pages";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed", route: "/pages/api/candidate/evidence/upload-url" });
  }

  try {
    const supabase = createPagesRouteClient(req, res);
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
    const mime = String(body?.mime ?? "").trim();
    const size_bytes = Number(body?.size_bytes ?? 0);
    const original_name = safeFilename(String(body?.filename ?? "file"));
    const evidence_type = body?.evidence_type ? String(body.evidence_type).slice(0, 50) : null;
    const file_sha256 = body?.file_sha256 ? String(body.file_sha256).toLowerCase() : null;

    if (!verification_request_id) {
      return json(res, 400, { error: "Falta verification_request_id", route: "/pages/api/candidate/evidence/upload-url" });
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

    const { data: vr, error: vrErr } = await supabase
      .from("verification_requests")
      .select("id")
      .eq("id", verification_request_id)
      .maybeSingle();

    if (vrErr) {
      return json(res, 400, {
        error: "Error consultando verification_requests",
        route: "/pages/api/candidate/evidence/upload-url",
        details: vrErr.message,
      });
    }
    if (!vr) {
      return json(res, 404, {
        error: "verification_request no encontrada o sin acceso",
        route: "/pages/api/candidate/evidence/upload-url",
      });
    }

    const userId = auth.user.id;
    const uuid = randomUUID();
    const ext = extFromMime(mime, original_name);
    const storage_path = `evidence/${userId}/${verification_request_id}/${uuid}.${ext}`;
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
      signed_url: data.signedUrl,
      token: data.token,
      mime,
      size_bytes,
      evidence_type,
      file_sha256,
      evidence_client_ref,
      note: "Sube el archivo usando signed_url y luego llama a POST /api/candidate/evidence/confirm para registrar la evidencia en DB.",
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
