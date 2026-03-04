import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

async function extractPdfText(buf: Buffer): Promise<string> {
  // pdfjs legacy build (CJS) para Node
  const pdfjs: any = require("pdfjs-dist/legacy/build/pdf.js");

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const pdf = await loadingTask.promise;

  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items || [])
      .map((it: any) => (typeof it.str === "string" ? it.str : ""))
      .join(" ");
    parts.push(pageText);
  }

  return parts.join("\n").replace(/\s+\n/g, "\n").trim();
}

export async function extractCvTextFromBuffer(buf: Buffer, mimeType?: string | null): Promise<string> {
  const mt = (mimeType || "").toLowerCase();

  if (mt.includes("pdf") || mt === "application/pdf") {
    try {
      return await extractPdfText(buf);
    } catch (e: any) {
      throw new Error(`pdf_extract_failed: ${String(e?.message || e)}`);
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
