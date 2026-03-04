type ExtractResult = {
  result: any;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

function pickOutputText(resp: any): string {
  const out = resp?.output;
  if (!Array.isArray(out)) return "";
  for (const item of out) {
    if (item?.type === "message" && Array.isArray(item?.content)) {
      const c = item.content.find((x: any) => x?.type === "output_text" && typeof x?.text === "string");
      if (c?.text) return c.text;
    }
  }
  return "";
}

export async function extractStructuredFromCvText(cvText: string): Promise<ExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.CV_PARSE_MODEL || "gpt-4.1-mini";

  const instructions =
    "Eres un extractor de CV. Devuelve SOLO JSON válido (sin markdown), en español. " +
    "Estructura: { personal:{name,email,phone,location,links:[]}, summary, skills:[], languages:[], experience:[], education:[], certifications:[], projects:[] } " +
    "Si un campo no existe, pon null o []. No inventes.";

  const prompt =
    instructions +
    "\n\nCV (texto):\n" +
    cvText.slice(0, 120000);

  const body = {
    model,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    // Responses API: el formato va en text.format (no response_format)
    text: { format: { type: "json_object" } },
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await r.text();
  if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${raw}`);

  const resp = JSON.parse(raw);
  const outText = pickOutputText(resp);
  if (!outText) throw new Error("OpenAI response missing output_text");

  let parsed: any;
  try {
    parsed = JSON.parse(outText);
  } catch (e: any) {
    throw new Error(`OpenAI returned non-JSON: ${outText.slice(0, 400)}...`);
  }

  const usage = resp?.usage || null;
  return {
    result: parsed,
    model: resp?.model ?? model,
    tokensIn: usage?.input_tokens ?? null,
    tokensOut: usage?.output_tokens ?? null,
  };
}
