import "server-only";

type MaybeMime = string | null | undefined;

/**
 * Extrae texto de un PDF desde un Buffer (Node).
 * - NO usa rutas locales
 * - NO usa pdfjs-dist (evita canvas)
 * - Compatible con Vercel/Node runtime
 */
export async function extractCvTextFromBuffer(buf: Buffer, mime: MaybeMime = null): Promise<string> {
  if (!buf || buf.length < 10) throw new Error("pdf_extract_failed: empty_buffer");

  // Si no es PDF, devolvemos texto plano “best effort”
  const isPdf = (mime && mime.includes("pdf")) || buf.slice(0, 4).toString("utf8") === "%PDF";
  if (!isPdf) {
    try {
      return buf.toString("utf8");
    } catch {
      return "";
    }
  }

  try {
    // pdf-parse en CJS funciona bien en Node runtime, pero lo cargamos dinámico para evitar bundling raro.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buf);
    const text = (data?.text || "").trim();
    if (!text) throw new Error("empty_text");
    return text;
  } catch (e: any) {
    throw new Error(`pdf_parse_failed: ${String(e?.message || e)}`);
  }
}
