import mammoth from "mammoth";

/**
 * Extrae texto de un CV desde un Buffer (PDF o DOCX).
 * PDF: pdf-parse@1.1.1 cargado por require("pdf-parse/lib/pdf-parse.js") (CJS) => evita pdfjs-dist/canvas.
 * DOCX: mammoth.
 */
export async function extractCvTextFromBuffer(buf: Buffer, filename?: string): Promise<string> {
  const name = (filename || "").toLowerCase();

  const looksPdfByName = name.endsWith(".pdf");
  const looksDocxByName = name.endsWith(".docx") || name.endsWith(".doc");
  const isPdfByMagic =
    buf.length >= 4 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF

  if (looksPdfByName || isPdfByMagic) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse: any = require("pdf-parse/lib/pdf-parse.js");
      const out = await pdfParse(buf);
      const text = (out?.text || "").toString().trim();
      if (!text) throw new Error("empty_pdf_text");
      return text;
    } catch (e: any) {
      throw new Error(`pdf_extract_failed: ${e?.message || String(e)}`);
    }
  }

  if (looksDocxByName) {
    try {
      const res = await mammoth.extractRawText({ buffer: buf });
      const text = (res?.value || "").toString().trim();
      if (!text) throw new Error("empty_docx_text");
      return text;
    } catch (e: any) {
      throw new Error(`docx_extract_failed: ${e?.message || String(e)}`);
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
    const pdfParse: any = require("pdf-parse/lib/pdf-parse.js");
    const out = await pdfParse(buf);
    const text = (out?.text || "").toString().trim();
    if (text) return text;
  } catch {}

  throw new Error("unsupported_file_type");
}
