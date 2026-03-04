import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractCvTextFromBuffer(buf: Buffer, mimeType?: string | null): Promise<string> {
  const mt = (mimeType || "").toLowerCase();

  // PDF
  if (mt.includes("pdf") || mt === "application/pdf") {
    // pdf-parse en ESM/TS suele no exponer default export -> usamos namespace import
    const out = await (pdfParse as any)(buf);
    return (out?.text || "").trim();
  }

  // DOCX
  if (mt.includes("wordprocessingml") || mt.includes("docx")) {
    const out = await mammoth.extractRawText({ buffer: buf });
    return (out.value || "").trim();
  }

  // fallback: texto plano
  try {
    return buf.toString("utf8").trim();
  } catch {
    return "";
  }
}
