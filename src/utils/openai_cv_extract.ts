type ExtractOut = {
  result: any;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

function getOutputText(resp: any): string {
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text.trim();
  const out = resp?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part?.type === "output_text" && typeof part?.text === "string") {
            const t = part.text.trim();
            if (t) return t;
          }
        }
      }
    }
  }
  return "";
}

export async function openaiCvExtractJSON(params: { apiKey: string; model: string; prompt: string }): Promise<ExtractOut> {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: params.prompt }],
        },
      ],
      // En Responses API: response_format => text.format
      text: { format: { type: "json_object" } },
      temperature: 0,
    }),
  });

  const raw = await r.text();
  if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${raw}`);

  const data = JSON.parse(raw);
  const outText = getOutputText(data);
  if (!outText) throw new Error("openai_no_output_text");

  let parsed: any = null;
  try {
    parsed = JSON.parse(outText);
  } catch {
    // si el modelo devolviera texto sucio, al menos lo guardamos
    parsed = { raw: outText };
  }

  return {
    result: parsed,
    model: data?.model ?? null,
    tokensIn: data?.usage?.input_tokens ?? null,
    tokensOut: data?.usage?.output_tokens ?? null,
  };
}
