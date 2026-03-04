import { z } from "zod";

const ExperienceSchema = z.object({
  company_name: z.string().min(1),
  role_title: z.string().min(1),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  skills: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(1).optional().default(0.5),
});

const CvExtractSchema = z.object({
  full_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  experiences: z.array(ExperienceSchema).default([]),
});

export type CvExtractResult = z.infer<typeof CvExtractSchema>;

function parseJsonLoose(text: string): any {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}$/);
  if (m) return JSON.parse(m[0]);
  throw new Error("OpenAI output is not valid JSON");
}

export async function extractStructuredFromCvText(cvText: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.CV_PARSE_MODEL || "gpt-4.1-mini";

  const instructions = [
    "Devuelve SOLO JSON válido (sin markdown, sin texto extra).",
    "No inventes datos. Si no existe, null.",
    "Campos: full_name, email, phone, headline, experiences[].",
    "experiences[]: company_name, role_title, start_date, end_date, location, description, skills, confidence(0-1).",
  ].join("\n");

  const body = {
    model,
    input: [
      { role: "system", content: [{ type: "text", text: instructions }] },
      { role: "user", content: [{ type: "text", text: cvText.slice(0, 120000) }] },
    ],
    text: { format: { type: "text" } },
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`OpenAI error ${resp.status}: ${t.slice(0, 400)}`);
  }

  const data: any = await resp.json();
  const outText = String(data?.output_text || "").trim();
  const parsed = parseJsonLoose(outText);
  const result = CvExtractSchema.parse(parsed);

  const usage = data?.usage || {};
  return {
    result,
    model: data?.model || model,
    tokensIn: usage?.input_tokens,
    tokensOut: usage?.output_tokens,
  };
}
