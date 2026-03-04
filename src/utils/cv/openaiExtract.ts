type ExtractOut = {
  result: unknown;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

function pickOutputText(json: any): string {
  // Responses API suele traer output_text; si no, reconstruimos desde output[].
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
  // Campos comunes en Responses
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

  const system = [
    "Eres un extractor de CVs. Devuelve SOLO JSON válido, sin markdown.",
    "Idioma de salida: español.",
    "Estructura esperada (claves orientativas):",
    "- personal: { nombre, email, telefono, localidad, pais, links[] }",
    "- titular: string",
    "- resumen: string",
    "- experiencia: [{ empresa, puesto, ubicacion, inicio, fin, descripcion, logros[] }]",
    "- educacion: [{ centro, titulo, inicio, fin, detalles }]",
    "- habilidades: { tecnicas[], blandas[], idiomas: [{ idioma, nivel }] }",
    "- certificaciones: [{ nombre, emisor, fecha }]",
    "- otros: { voluntariado, publicaciones, premios }",
    "Si falta algo, pon null o arrays vacíos.",
  ].join("\n");

  const payload = {
    model,
    // Responses API: input es un array de mensajes con content typed
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: cvText }] },
    ],
    // pedimos salida JSON; si el modelo no soporta response_format, igual devolvemos texto y lo parseamos
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

  // Intentamos leer JSON directo del output_text
  const outText = pickOutputText(json).trim();
  let result: any = null;

  if (outText) {
    try {
      result = JSON.parse(outText);
    } catch {
      // si response_format funcionó, a veces viene un objeto ya dentro de output (según implementación); fallback a texto crudo
      result = { raw: outText };
    }
  } else if (json && typeof json === "object") {
    // último recurso: devolvemos el propio json (acotado)
    result = { raw: json };
  }

  return {
    result,
    model: json?.model ?? model,
    tokensIn: inTok,
    tokensOut: outTok,
  };
}
