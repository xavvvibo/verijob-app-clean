import mammoth from "mammoth";

export async function extractCvTextFromBuffer(buf: Buffer, mimeType?: string | null): Promise<string> {
  const mt = (mimeType || "").toLowerCase();

  if (mt.includes("pdf") || mt === "application/pdf") {
    try {
      // Import dinámico: evita crash en load-time del módulo
      const pdfParseMod: any = await import("pdf-parse");
      const pdfParseFn = pdfParseMod?.default || pdfParseMod;
      const out = await pdfParseFn(buf);
      return String(out?.text || "").trim();
    } catch (e: any) {
      // Dejamos mensaje claro para debug en job.error si hiciera falta
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
