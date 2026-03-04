import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractCvTextFromBuffer(buf: Buffer, mimeType?: string | null): Promise<string> {
  const mt = (mimeType || "").toLowerCase();

  if (mt.includes("pdf") || mt === "application/pdf") {
    const out = await (pdfParse as any)(buf);
    return String(out?.text || "").trim();
  }

  if (mt.includes("wordprocessingml") || mt.includes("docx")) {
    const out = await mammoth.extractRawText({ buffer: buf });
    return String(out?.value || "").trim();
  }

  try {
    return buf.toString("utf8").trim();
  } catch {
    return "";
  }
}
