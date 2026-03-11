import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { z } from "zod";
import { extractCvTextFromBuffer } from "@/utils/cv/extractText";
import { normalizeCvLanguages } from "@/lib/candidate/cv-parse-normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function getServiceKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    null
  );
}

function getOpenAIKey(): string | null {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.OPEN_API_KEY ||
    process.env.OPENAI_KEY ||
    null
  );
}

function getInternalSecret(): string {
  return process.env.INTERNAL_ADMIN_SECRET || "";
}

function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getServiceKey();
  if (!url || !key) {
    throw new Error("missing_supabase_admin_env");
  }
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } }) as any;
}

const ExperienceSchema = z.object({
  company_name: z.string().nullable().optional(),
  role_title: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  skills: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const EducationSchema = z.object({
  institution: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  study_field: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const CvExtractSchema = z.object({
  full_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  languages: z.array(z.string()).optional().default([]),
  experiences: z.array(ExperienceSchema).optional().default([]),
  education: z.array(EducationSchema).optional().default([]),
});

function buildCvExtractionPrompt(cvText: string) {
  return [
    "Extrae información estructurada de este CV en JSON válido.",
    "No inventes datos. Si no existe un campo, usa null o array vacío.",
    "Debes separar experiencia laboral y formación académica.",
    "",
    "Devuelve exactamente este objeto JSON:",
    "{",
    '  "full_name": string|null,',
    '  "email": string|null,',
    '  "phone": string|null,',
    '  "headline": string|null,',
    '  "languages": string[],',
    '  "experiences": [',
    "    {",
    '      "company_name": string|null,',
    '      "role_title": string|null,',
    '      "start_date": string|null,',
    '      "end_date": string|null,',
    '      "location": string|null,',
    '      "description": string|null,',
    '      "skills": string[],',
    '      "confidence": number|null',
    "    }",
    "  ],",
    '  "education": [',
    "    {",
    '      "institution": string|null,',
    '      "title": string|null,',
    '      "study_field": string|null,',
    '      "start_date": string|null,',
    '      "end_date": string|null,',
    '      "description": string|null,',
    '      "confidence": number|null',
    "    }",
    "  ]",
    "}",
    "",
    "Texto del CV:",
    cvText,
  ].join("\n");
}

function readResponseOutputText(resp: any): string {
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text.trim();
  if (Array.isArray(resp?.output)) {
    for (const item of resp.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const part of item.content) {
        if (part?.type === "output_text" && typeof part?.text === "string" && part.text.trim()) {
          return part.text.trim();
        }
      }
    }
  }
  return "";
}

function normalizeExtract(raw: any) {
  const parsed = CvExtractSchema.parse(raw || {});
  return {
    full_name: parsed.full_name ?? null,
    email: parsed.email ?? null,
    phone: parsed.phone ?? null,
    headline: parsed.headline ?? null,
    languages: normalizeCvLanguages(parsed.languages, 30),
    experiences: parsed.experiences.map((x) => ({
      company_name: x.company_name ?? null,
      role_title: x.role_title ?? null,
      start_date: x.start_date ?? null,
      end_date: x.end_date ?? null,
      location: x.location ?? null,
      description: x.description ?? null,
      skills: Array.isArray(x.skills) ? x.skills.filter(Boolean) : [],
      confidence: typeof x.confidence === "number" ? x.confidence : null,
    })),
    education: parsed.education.map((x) => ({
      institution: x.institution ?? null,
      title: x.title ?? null,
      study_field: x.study_field ?? null,
      start_date: x.start_date ?? null,
      end_date: x.end_date ?? null,
      description: x.description ?? null,
      confidence: typeof x.confidence === "number" ? x.confidence : null,
    })),
  };
}

function buildWarnings(input: { cvText: string; experiences: any[]; education: any[]; languages?: string[] }) {
  const warnings: string[] = [];
  const plain = input.cvText.replace(/\s+/g, " ").trim();
  const wordCount = plain ? plain.split(" ").length : 0;

  if (plain.length < 400 || wordCount < 80) {
    warnings.push("cv_text_insufficient");
  }
  if (input.experiences.length === 0) {
    warnings.push("no_experiences_detected");
  }
  if (input.education.length === 0) {
    warnings.push("no_education_detected");
  }
  if (!Array.isArray(input.languages) || input.languages.length === 0) {
    warnings.push("no_languages_detected");
  }
  return { warnings, chars: plain.length, words: wordCount };
}

export async function POST(req: Request) {
  let jobId: string | null = null;
  let supabase: any = null;

  try {
    const internalSecret = getInternalSecret();
    const suppliedSecret = req.headers.get("x-internal-secret") || "";
    const isInternalCall = !!internalSecret && suppliedSecret === internalSecret;
    let requesterUserId: string | null = null;

    if (!isInternalCall) {
      const auth = await createRouteHandlerClient();
      const {
        data: { user },
      } = await auth.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      requesterUserId = user.id;
    }

    const payload = await req.json().catch(() => null);
    jobId = typeof payload?.job_id === "string" ? payload.job_id.trim() : null;
    if (!jobId) {
      return NextResponse.json({ error: "missing_job_id" }, { status: 400 });
    }

    supabase = createAdminClient();

    const { data: job, error: jobErr } = await (supabase as any)
      .from("cv_parse_jobs")
      .select("id,user_id,cv_upload_id")
      .eq("id", jobId)
      .single();

    const jobRow = (job ?? null) as { id: string; user_id: string; cv_upload_id: string } | null;

    if (jobErr) {
      return NextResponse.json({ error: "job_query_failed", details: jobErr.message }, { status: 400 });
    }

    if (!jobRow) {
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }

    if (!isInternalCall && requesterUserId && jobRow.user_id !== requesterUserId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await (supabase as any)
      .from("cv_parse_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", jobRow.id);

    const { data: upload, error: uploadErr } = await (supabase as any)
      .from("cv_uploads")
      .select("*")
      .eq("id", jobRow.cv_upload_id)
      .single();

    const uploadRow = (upload ?? null) as
      | { storage_bucket: string; storage_path: string; original_filename?: string | null }
      | null;

    if (uploadErr || !uploadRow) {
      throw new Error(`upload_not_found: ${uploadErr?.message || "missing_upload"}`);
    }

    const bucketPrefix = `${uploadRow.storage_bucket}/`;
    const normalizedStoragePath = uploadRow.storage_path.startsWith(bucketPrefix)
      ? uploadRow.storage_path.slice(bucketPrefix.length)
      : uploadRow.storage_path;

    const { data: file, error: downloadErr } = await (supabase as any).storage
      .from(uploadRow.storage_bucket)
      .download(normalizedStoragePath);

    if (downloadErr || !file) {
      throw new Error(`file_download_failed: ${downloadErr?.message || "missing_file"}`);
    }

    const effectiveFilename =
      uploadRow.original_filename ||
      uploadRow.storage_path.split("/").pop() ||
      "cv_upload.pdf";

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const extractedText = (await extractCvTextFromBuffer(fileBuffer, effectiveFilename)).trim();
    if (!extractedText) throw new Error("empty_cv_text");

    const openaiKey = getOpenAIKey();
    if (!openaiKey) throw new Error("missing_openai_api_key");

    const prompt = buildCvExtractionPrompt(extractedText.slice(0, 120000));

    const resp = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "user",
              content: [{ type: "input_text", text: prompt }],
            }
          ],
          text: { format: { type: "json_object" } },
          temperature: 0,
        })
      }
    );

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`openai_response_failed_${resp.status}: ${txt.slice(0, 300)}`);
    }

    const raw = await resp.json();
    const outputText = readResponseOutputText(raw);
    if (!outputText) throw new Error("openai_no_output_text");

    let parsed: any = null;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new Error("openai_invalid_json_output");
    }

    const normalized = normalizeExtract(parsed);
    const warningData = buildWarnings({
      cvText: extractedText,
      experiences: normalized.experiences,
      education: normalized.education,
      languages: normalized.languages,
    });

    await (supabase as any)
      .from("cv_parse_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        error: null,
        result_json: {
          ...normalized,
          meta: {
            model: raw?.model ?? "gpt-4.1-mini",
            input_tokens: raw?.usage?.input_tokens ?? null,
            output_tokens: raw?.usage?.output_tokens ?? null,
            warnings: warningData.warnings,
            extracted_text_chars: warningData.chars,
            extracted_text_words: warningData.words,
          },
        },
      })
      .eq("id", jobRow.id);

    return NextResponse.json({
      ok: true,
      job_id: jobRow.id
    });

  } catch (e:any) {
    if (supabase && jobId) {
      await (supabase as any)
        .from("cv_parse_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: String(e?.message || e).slice(0, 1000),
        })
        .eq("id", jobId);
    }

    return NextResponse.json({
      error: "trigger_failed",
      details: String(e?.message || e)
    }, { status: 500 });

  }
}
