import { z } from "zod";

const ExperienceSchema = z.object({
  company_name: z.string().min(1),
  role_title: z.string().min(1),
  start_date: z.string().nullable().optional(),  // "YYYY-MM" o "YYYY-MM-DD"
  end_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  skills: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(1).optional().default(0.5),
});

export type CvExperience = z.infer<typeof ExperienceSchema>;

const CvExtractSchema = z.object({
  full_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  experiences: z.array(ExperienceSchema).default([]),
});

export type CvExtractResult = z.infer<typeof CvExtractSchema>;

export async function extractStructuredFromCvText(cvText: string): Promise<{ result: CvExtractResult; tokensIn?: number; tokensOut?: number; model?: string; raw?: any; }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.CV_PARSE_MODEL || "gpt-4.1-mini";

  const prompt = [
    "Eres un parser de CV para un producto de credenciales laborales verificadas.",
    "Extrae EXPERIENCIAS LABORALES y datos básicos. Devuelve SOLO JSON válido sin markdown.",
    "Reglas:",
    "- Si no conoces una fecha, usa null.",
    "- start_date/end_date en formato 'YYYY-MM' si es posible; si solo hay año, usa 'YYYY-01'.",
    "- confidence 0..1 según claridad del CV.",
    "",
    "Formato JSON:",
    "{",
    "  full_name: string|null,",
    "  email: string|null,",
    "  phone: string|null,",
    "  headline: string|null,",
    "  experiences: [",
    "    { company_name, role_title, start_date, end_date, location, description, skills[], confidence }",
    "  ]",
    "}",
  ].join("\n");

  const body = {
    model,
    response_format: { type: "json_object" },
    input: [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: cvText.slice(0, 180000),
      },
    ],
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = await r.json();
  if (!r.ok) {
    const msg = json?.error?.message || `OpenAI error (${r.status})`;
    throw new Error(msg);
  }

  // responses API devuelve output_text; aquí buscamos el texto JSON final
  const outText =
    json?.output?.map((o: any) => o?.content?.map((c: any) => c?.text).filter(Boolean).join("")).filter(Boolean).join("\n")
    || json?.output_text
    || "";

  let parsed: any;
  try {
    parsed = JSON.parse(outText);
  } catch {
    // fallback: algunos modelos devuelven el json dentro de otros campos
    parsed = json;
  }

  const result = CvExtractSchema.parse(parsed);

  const usage = json?.usage || {};
  return {
    result,
    tokensIn: usage?.input_tokens,
    tokensOut: usage?.output_tokens,
    model,
    raw: json,
  };
}
