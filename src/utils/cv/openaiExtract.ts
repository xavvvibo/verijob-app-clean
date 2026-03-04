import { z } from "zod";

const CvStructuredSchema = z.object({
  full_name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  skills: z.array(z.string()).optional().nullable(),
  languages: z.array(z.string()).optional().nullable(),
  links: z.array(z.string()).optional().nullable(),
  experiences: z
    .array(
      z.object({
        company: z.string().optional().nullable(),
        title: z.string().optional().nullable(),
        location: z.string().optional().nullable(),
        start_date: z.string().optional().nullable(), // ISO-ish "YYYY-MM" o "YYYY"
        end_date: z.string().optional().nullable(),
        is_current: z.boolean().optional().nullable(),
        description: z.string().optional().nullable(),
        bullets: z.array(z.string()).optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  education: z
    .array(
      z.object({
        institution: z.string().optional().nullable(),
        degree: z.string().optional().nullable(),
        field: z.string().optional().nullable(),
        start_date: z.string().optional().nullable(),
        end_date: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  certifications: z.array(z.string()).optional().nullable(),
});

export type CvStructured = z.infer<typeof CvStructuredSchema>;

function pickOutputText(resp: any): string {
  // Responses API suele traer output[] con items que contienen content[] con type=output_text
  const out = resp?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === "output_text" && typeof c?.text === "string") return c.text;
        }
      }
    }
  }
  // fallback por si aparece en otro campo
  if (typeof resp?.output_text === "string") return resp.output_text;
  if (typeof resp?.text === "string") return resp.text;
  return "";
}

export async function extractStructuredFromCvText(cvText: string): Promise<CvStructured> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("openai_missing_api_key");

  const model = process.env.CV_PARSE_MODEL || "gpt-4.1-mini";

  // Recortamos para evitar payloads enormes (ajusta si quieres)
  const clipped = cvText.length > 22000 ? cvText.slice(0, 22000) : cvText;

  const instructions =
    "Eres un extractor de CV. Devuelve SOLO JSON válido (sin markdown). " +
    "Normaliza fechas a 'YYYY-MM' o 'YYYY' cuando se pueda. " +
    "Si un dato no existe, deja null o no lo incluyas. " +
    "En experiences intenta separar company, title, start_date, end_date, is_current y bullets.";

  const payload = {
    model,
    input: [
      {
        role: "user",
        content: [
          // CLAVE: en Responses API es input_text, no "text"
          { type: "input_text", text: `${instructions}\n\nCV:\n${clipped}` },
        ],
      },
    ],
    // Pedimos JSON estricto si está soportado; si el modelo no lo soporta, igual suele devolver JSON limpio.
    text: {
      format: {
        type: "json_schema",
        json_schema: {
          name: "cv_structured",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              full_name: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              location: { type: ["string", "null"] },
              headline: { type: ["string", "null"] },
              summary: { type: ["string", "null"] },
              skills: { type: ["array", "null"], items: { type: "string" } },
              languages: { type: ["array", "null"], items: { type: "string" } },
              links: { type: ["array", "null"], items: { type: "string" } },
              experiences: {
                type: ["array", "null"],
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    company: { type: ["string", "null"] },
                    title: { type: ["string", "null"] },
                    location: { type: ["string", "null"] },
                    start_date: { type: ["string", "null"] },
                    end_date: { type: ["string", "null"] },
                    is_current: { type: ["boolean", "null"] },
                    description: { type: ["string", "null"] },
                    bullets: { type: ["array", "null"], items: { type: "string" } },
                  },
                },
              },
              education: {
                type: ["array", "null"],
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    institution: { type: ["string", "null"] },
                    degree: { type: ["string", "null"] },
                    field: { type: ["string", "null"] },
                    start_date: { type: ["string", "null"] },
                    end_date: { type: ["string", "null"] },
                    description: { type: ["string", "null"] },
                  },
                },
              },
              certifications: { type: ["array", "null"], items: { type: "string" } },
            },
            required: [],
          },
        },
      },
    },
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await r.json().catch(() => ({}));

  if (!r.ok) {
    const msg = typeof json?.error?.message === "string" ? json.error.message : JSON.stringify(json);
    throw new Error(`openai_failed_${r.status}: ${msg}`);
  }

  const outText = pickOutputText(json).trim();
  if (!outText) throw new Error("openai_empty_output");

  let parsed: any;
  try {
    parsed = JSON.parse(outText);
  } catch (e: any) {
    throw new Error(`openai_non_json_output: ${e?.message || String(e)} :: ${outText.slice(0, 280)}`);
  }

  const validated = CvStructuredSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`openai_schema_mismatch: ${validated.error.message}`);
  }

  return validated.data;
}
