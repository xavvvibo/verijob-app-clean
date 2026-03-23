import mammoth from "mammoth";

export class CvExtractionError extends Error {
  code: string;
  recoverable: boolean;

  constructor(code: string, message: string, recoverable = true) {
    super(message);
    this.name = "CvExtractionError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

const MAX_CV_SIZE_BYTES = 8 * 1024 * 1024;

function normalizeExtractedText(value: any) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function tryParsePdfWithDebuggingDisabled(buf: Buffer) {
  const parserModule = await import("pdf-parse-debugging-disabled");
  const parser: any = (parserModule as any)?.default || parserModule;
  const out = await parser(buf as any);
  const text = normalizeExtractedText(out?.text || "");
  if (!text) throw new Error("empty_pdf_text");
  return text;
}

async function tryParsePdfWithStandardParser(buf: Buffer) {
  const parserModule = await import("pdf-parse");
  const parser: any = (parserModule as any)?.default || parserModule;
  const out = await parser(buf as any);
  const text = normalizeExtractedText(out?.text || "");
  if (!text) throw new Error("empty_pdf_text");
  return text;
}

async function tryParsePdfWithFallbacks(buf: Buffer) {
  const errors: string[] = [];

  try {
    return await tryParsePdfWithDebuggingDisabled(buf);
  } catch (e: any) {
    errors.push(`debugging-disabled: ${String(e?.message || e)}`);
  }

  try {
    return await tryParsePdfWithStandardParser(buf);
  } catch (e: any) {
    errors.push(`standard: ${String(e?.message || e)}`);
  }

  throw new Error(errors.join(" | ") || "pdf_extract_failed");
}

function validateCvBuffer(buf: Buffer, filename?: string) {
  const name = (filename || "").toLowerCase();
  if (!buf || buf.length === 0) {
    throw new CvExtractionError("empty_file", "El archivo está vacío.");
  }
  if (buf.length > MAX_CV_SIZE_BYTES) {
    throw new CvExtractionError("file_too_large", "El archivo supera el tamaño máximo permitido de 8 MB.", false);
  }

  const looksPdfByName = name.endsWith(".pdf");
  const looksDocxByName = name.endsWith(".docx") || name.endsWith(".doc");
  const isPdfByMagic =
    buf.length >= 4 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46;
  const isZipByMagic = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;

  if (!looksPdfByName && !looksDocxByName && !isPdfByMagic && !isZipByMagic) {
    throw new CvExtractionError("unsupported_file_type", "Formato no soportado. Usa PDF o DOCX.", false);
  }
}

/**
 * Extrae texto de un CV desde un Buffer (PDF o DOCX).
 * PDF: intenta dos parsers de forma secuencial para reducir falsos fallos.
 * DOCX: mammoth.
 */
export async function extractCvTextFromBuffer(buf: Buffer, filename?: string): Promise<string> {
  validateCvBuffer(buf, filename);
  const name = (filename || "").toLowerCase();

  const looksPdfByName = name.endsWith(".pdf");
  const looksDocxByName = name.endsWith(".docx") || name.endsWith(".doc");
  const isPdfByMagic =
    buf.length >= 4 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46;

  if (looksPdfByName || isPdfByMagic) {
    try {
      return await tryParsePdfWithFallbacks(buf);
    } catch (e: any) {
      throw new CvExtractionError(
        "pdf_extract_failed",
        `No hemos podido leer este PDF. Puedes continuar completando tu perfil manualmente. Detalle técnico: ${e?.message || String(e)}`
      );
    }
  }

  if (looksDocxByName) {
    try {
      const res = await mammoth.extractRawText({ buffer: buf });
      const text = normalizeExtractedText(res?.value || "");
      if (!text) throw new Error("empty_docx_text");
      return text;
    } catch (e: any) {
      throw new CvExtractionError(
        "docx_extract_failed",
        `No hemos podido leer este DOCX. Puedes continuar completando tu perfil manualmente. Detalle técnico: ${e?.message || String(e)}`
      );
    }
  }

  try {
    const res = await mammoth.extractRawText({ buffer: buf });
    const text = normalizeExtractedText(res?.value || "");
    if (text) return text;
  } catch {}

  try {
    const text = await tryParsePdfWithFallbacks(buf);
    if (text) return text;
  } catch {}

  throw new CvExtractionError("unsupported_file_type", "Formato no soportado. Usa PDF o DOCX.", false);
}
