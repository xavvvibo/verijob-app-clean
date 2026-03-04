/**
 * Helper legacy (por compat) — mismo contrato que cv/openaiExtract.ts.
 * Mantenerlo alineado evita 400s si alguna ruta antigua lo usa.
 */
type ExtractOut = {
  result: unknown;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

function pickOutputText(json: any): string {
  if (typeof json?.output_text === "string" && json.output_text.length > 0) return json.output_text;

  const out = json?.output;
  if (Array.isArray(out)) {
    const parts: string[] = [];
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === "output_text" && typeof c?.text === "string") parts.push(c.text);
        }
      }
    }
    if (parts.length) return parts.join("\n");
  }
  return "";
}

function pickUsage(json: any): { inTok: number | null; outTok: number | null } {
  const u = json?.usage;
  const inTok =
    typeof u?.input_tokens === "number" ? u.input_tokens :
    typeof u?.prompt_tokens === "number" ? u.prompt_tokens :
    null;
  const outTok =
    typeof u?.output_tokens === "number" ? u.output_tokens :
    typeof u?.completion_tokens === "number" ? u.completion_tokens :
    null;
  return { inTok, outTok };
}

export async function extractStructuredFromCvText(cvText: string): Promise<ExtractOut> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.CV_PARSE_MODEL || "gpt-4.1-mini";

  const payload = {
    model,
    input: [
      { role: "user", content: [{ type: "input_text", text: cvText }] },
    ],
    response_format: { type: "json_object" },
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const txt = await r.text();
  if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${txt}`);

  const json = JSON.parse(txt);
  const { inTok, outTok } = pickUsage(json);

  const outText = pickOutputText(json).trim();
  let result: any = null;

  if (outText) {
    try { result = JSON.parse(outText); }
    catch { result = { raw: outText }; }
  } else {
    result = { raw: json };
  }

  return {
    result,
    model: json?.model ?? model,
    tokensIn: inTok,
    tokensOut: outTok,
  };
}
