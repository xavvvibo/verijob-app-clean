import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractCvTextFromBuffer(buf: Buffer, mimeType?: string | null): Promise<string> {
  const mt = (mimeType || "").toLowerCase();

  // PDF
  if (mt.includes("pdf") || mt === "application/pdf") {
    const out = await pdfParse(buf);
    return (out.text || "").trim();
  }

  // DOCX
  if (mt.includes("wordprocessingml") || mt.includes("docx")) {
    const out = await mammoth.extractRawText({ buffer: buf });
    return (out.value || "").trim();
  }

  // fallback: intenta tratar como texto plano
  try {
    return buf.toString("utf8").trim();
  } catch {
    return "";
  }
}
