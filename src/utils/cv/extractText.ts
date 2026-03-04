import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export async function extractCvTextFromBuffer(buf: Buffer, mimeType?: string | null): Promise<string> {
  const mt = (mimeType || "").toLowerCase();

  if (mt.includes("pdf") || mt === "application/pdf") {
    try {
      const mod: any = require("pdf-parse");
      const pdfParse = mod?.default || mod;
      const out = await pdfParse(buf);
      return String(out?.text || "").trim();
    } catch (e: any) {
      throw new Error(`pdf_parse_failed: ${String(e?.message || e)}`);
    }
  }

  if (mt.includes("wordprocessingml") || mt.includes("docx")) {
    try {
      const out = await mammoth.extractRawText({ buffer: buf });
      return String(out?.value || "").trim();
    } catch (e: any) {
      throw new Error(`docx_extract_failed: ${String(e?.message || e)}`);
    }
  }

  try {
    return buf.toString("utf8").trim();
  } catch (e: any) {
    throw new Error(`text_decode_failed: ${String(e?.message || e)}`);
  }
}
