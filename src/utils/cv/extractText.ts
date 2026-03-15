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

function validateCvBuffer(buf: Buffer, filename?: string) {
  const name = (filename || "").toLowerCase();
  if (!buf || buf.length === 0) {
    throw new CvExtractionError("empty_file", "El archivo esta vacio.");
  }
  if (buf.length > MAX_CV_SIZE_BYTES) {
    throw new CvExtractionError("file_too_large", "El archivo supera el tamano maximo permitido de 8 MB.", false);
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
 * PDF: pdf-parse-debugging-disabled (fork drop-in que evita el modo debug/test que intenta abrir ./test/data/*.pdf en serverless).
 * DOCX: mammoth.
 */
export async function extractCvTextFromBuffer(buf: Buffer, filename?: string): Promise<string> {
  validateCvBuffer(buf, filename);
  const name = (filename || "").toLowerCase();

  const looksPdfByName = name.endsWith(".pdf");
  const looksDocxByName = name.endsWith(".docx") || name.endsWith(".doc");
  const isPdfByMagic =
    buf.length >= 4 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF

  if (looksPdfByName || isPdfByMagic) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse: any = require("pdf-parse-debugging-disabled");
      const out = await pdfParse(buf);
      const text = (out?.text || "").toString().trim();
      if (!text) throw new Error("empty_pdf_text");
      return text;
    } catch (e: any) {
      throw new CvExtractionError(
        "pdf_extract_failed",
        `No hemos podido leer este PDF. Puedes continuar completando tu perfil manualmente. Detalle tecnico: ${e?.message || String(e)}`
      );
    }
  }

  if (looksDocxByName) {
    try {
      const res = await mammoth.extractRawText({ buffer: buf });
      const text = (res?.value || "").toString().trim();
      if (!text) throw new Error("empty_docx_text");
      return text;
    } catch (e: any) {
      throw new CvExtractionError(
        "docx_extract_failed",
        `No hemos podido leer este DOCX. Puedes continuar completando tu perfil manualmente. Detalle tecnico: ${e?.message || String(e)}`
      );
    }
  }

  // Fallbacks si no hay extensión fiable
  try {
    const res = await mammoth.extractRawText({ buffer: buf });
    const text = (res?.value || "").toString().trim();
    if (text) return text;
  } catch {}

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse: any = require("pdf-parse-debugging-disabled");
    const out = await pdfParse(buf);
    const text = (out?.text || "").toString().trim();
    if (text) return text;
  } catch {}

  throw new CvExtractionError("unsupported_file_type", "Formato no soportado. Usa PDF o DOCX.", false);
}
