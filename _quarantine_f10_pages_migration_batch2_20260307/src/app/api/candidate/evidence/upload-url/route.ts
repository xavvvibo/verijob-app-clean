import { NextResponse } from "next/server";
import { randomUUID, createHash } from "crypto";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "evidence"; // nombre del bucket en Supabase Storage
const MAX_MB = 20;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

function safeFilename(name: string) {
  // elimina rutas, caracteres raros y limita longitud
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
  // fallback por nombre
  const m = lower.match(/\.([a-z0-9]{2,5})$/);
  return m?.[1] ?? "bin";
}

function isHexSha256(s?: string) {
  if (!s) return true; // opcional
  return /^[a-f0-9]{64}$/i.test(s);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return jsonError(401, "No autenticado");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body JSON inválido");
  }

  const verification_request_id = String(body?.verification_request_id ?? "").trim();
  const mime = String(body?.mime ?? "").trim();
  const size_bytes = Number(body?.size_bytes ?? 0);
  const original_name = safeFilename(String(body?.filename ?? "file"));
  const evidence_type = body?.evidence_type ? String(body.evidence_type).slice(0, 50) : null;
  const file_sha256 = body?.file_sha256 ? String(body.file_sha256).toLowerCase() : null;

  if (!verification_request_id) return jsonError(400, "Falta verification_request_id");
  if (!ALLOWED_MIME.has(mime)) return jsonError(400, "Tipo de archivo no permitido", { mime });
  if (!Number.isFinite(size_bytes) || size_bytes <= 0) return jsonError(400, "size_bytes inválido");
  if (size_bytes > MAX_MB * 1024 * 1024) return jsonError(400, "Archivo demasiado grande", { max_mb: MAX_MB });

  if (!isHexSha256(file_sha256 ?? undefined)) {
    return jsonError(400, "file_sha256 debe ser hex SHA-256 (64 chars) si se envía");
  }

  // Verifica que el usuario tiene acceso a esa verification_request (vía RLS en verification_requests)
  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .select("id")
    .eq("id", verification_request_id)
    .maybeSingle();

  if (vrErr) return jsonError(400, "Error consultando verification_requests", vrErr);
  if (!vr) return jsonError(404, "verification_request no encontrada o sin acceso");

  const userId = auth.user.id;
  const uuid = randomUUID();
  const ext = extFromMime(mime, original_name);

  // storage_path: evidence/{user_id}/{verification_request_id}/{uuid}.{ext}
  const storage_path = `evidence/${userId}/${verification_request_id}/${uuid}.${ext}`;

  // "idempotency" simple: hash del path (útil si quieres correlación)
  const evidence_client_ref = createHash("sha256").update(storage_path).digest("hex").slice(0, 16);

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storage_path);

  if (error || !data?.signedUrl) {
    return jsonError(400, "No se pudo generar signed upload URL", error);
  }

  return NextResponse.json({
    storage_path,
    signed_url: data.signedUrl,
    token: data.token,
    mime,
    size_bytes,
    evidence_type,
    file_sha256,
    evidence_client_ref,
    note:
      "Sube el archivo usando signed_url y luego llama a POST /api/candidate/evidence/confirm para registrar la evidencia en DB.",
  });
}
