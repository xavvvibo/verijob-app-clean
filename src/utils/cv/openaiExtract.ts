import { openaiCvExtractJSON } from "@/utils/openai_cv_extract";

export type CvStructuredOut = {
  result: any;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

function buildPrompt(cvText: string): string {
  // Prompt práctico: JSON “limpio” (porque forzamos text.format json_object)
  return [
    "Eres un extractor de CV. Devuelve SOLO un JSON válido (sin markdown).",
    "Extrae y normaliza la información del candidato desde el texto del CV.",
    "",
    "JSON schema orientativo (no incluyas campos inventados; usa null si no existe):",
    "{",
    '  "full_name": string|null,',
    '  "email": string|null,',
    '  "phone": string|null,',
    '  "location": string|null,',
    '  "headline": string|null,',
    '  "summary": string|null,',
    '  "skills": string[],',
    '  "languages": [{"name": string, "level": string|null}],',
    '  "experience": [{"company": string|null, "role": string|null, "start": string|null, "end": string|null, "location": string|null, "highlights": string[]}],',
    '  "education": [{"institution": string|null, "degree": string|null, "start": string|null, "end": string|null, "notes": string|null}],',
    '  "certifications": [{"name": string|null, "issuer": string|null, "date": string|null}],',
    '  "links": [{"label": string|null, "url": string|null}]',
    "}",
    "",
    "CV (texto):",
    cvText,
  ].join("\n");
}

export async function extractStructuredFromCvText(cvText: string): Promise<CvStructuredOut> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const prompt = buildPrompt(cvText);

  const out = await openaiCvExtractJSON({ apiKey, model, prompt });

  return {
    result: out.result,
    model: out.model ?? model,
    tokensIn: out.tokensIn ?? null,
    tokensOut: out.tokensOut ?? null,
  };
}
