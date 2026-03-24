const EVIDENCE_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EVIDENCE_ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
const CV_ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const CV_ALLOWED_MIME_PARTS = ["pdf", "wordprocessingml", "msword"];

function getExtension(filename: unknown) {
  const raw = String(filename || "").trim().toLowerCase();
  const ext = raw.split(".").pop() || "";
  return ext;
}

export function validateEvidenceFileMeta(input: {
  filename?: unknown;
  mime?: unknown;
  sizeBytes?: unknown;
  maxSizeBytes: number;
}) {
  const mime = String(input.mime || "").trim().toLowerCase();
  const extension = getExtension(input.filename);
  const size = Number(input.sizeBytes ?? 0);

  if (!mime || !EVIDENCE_ALLOWED_MIME.has(mime)) {
    return { ok: false as const, code: "invalid_mime_type", message: "Formato no compatible. Usa PDF, JPG, PNG o WEBP." };
  }
  if (!extension || !EVIDENCE_ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false as const, code: "invalid_extension", message: "La extensión del archivo no es compatible." };
  }
  const mimeByExtension =
    extension === "pdf" ? "application/pdf" :
    extension === "png" ? "image/png" :
    extension === "webp" ? "image/webp" :
    "image/jpeg";
  if (mimeByExtension !== mime) {
    return { ok: false as const, code: "mime_extension_mismatch", message: "El tipo de archivo no coincide con su extensión." };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false as const, code: "invalid_file_size", message: "No hemos podido validar el tamaño del archivo." };
  }
  if (size > input.maxSizeBytes) {
    return { ok: false as const, code: "file_too_large", message: "El archivo supera el tamaño máximo permitido." };
  }
  return { ok: true as const, mime, extension, size };
}

export function validateCvFileMeta(input: {
  filename?: unknown;
  mime?: unknown;
  sizeBytes?: unknown;
  maxSizeBytes: number;
}) {
  const filename = String(input.filename || "").trim();
  const mime = String(input.mime || "").trim().toLowerCase();
  const extension = getExtension(filename);
  const size = Number(input.sizeBytes ?? 0);

  const mimeLooksAllowed = !mime || CV_ALLOWED_MIME_PARTS.some((item) => mime.includes(item));
  if (!extension || !CV_ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false as const, code: "unsupported_file_type", message: "Formato no soportado. Usa PDF o DOCX." };
  }
  if (!mimeLooksAllowed) {
    return { ok: false as const, code: "unsupported_file_type", message: "Formato no soportado. Usa PDF o DOCX." };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false as const, code: "invalid_file_size", message: "No hemos podido validar el tamaño del archivo." };
  }
  if (size > input.maxSizeBytes) {
    return { ok: false as const, code: "file_too_large", message: "El archivo supera el tamaño máximo permitido de 8 MB." };
  }
  return { ok: true as const, extension, size, mime };
}
