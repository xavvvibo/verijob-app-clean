import crypto from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const COMPANY_CV_IMPORT_LEGAL_VERSION = "v1";

export function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken(size = 24): string {
  return crypto.randomBytes(size).toString("hex");
}

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildCompanyCvImportLegalSnapshot(input?: {
  companyName?: string | null;
  candidateEmail?: string | null;
  candidateName?: string | null;
  positionTitle?: string | null;
  targetRole?: string | null;
  importedAt?: string | null;
}) {
  return {
    version: COMPANY_CV_IMPORT_LEGAL_VERSION,
    accepted_company_name: input?.companyName ?? null,
    accepted_candidate_email: input?.candidateEmail ?? null,
    accepted_candidate_name: input?.candidateName ?? null,
    accepted_position_title: input?.positionTitle ?? input?.targetRole ?? null,
    accepted_at: input?.importedAt ?? new Date().toISOString(),
    text: "La empresa declara que dispone de base legítima para compartir este CV con VERIJOB e invitar al candidato a revisar y confirmar la importación de sus datos.",
  };
}

export async function ensureCandidatePublicToken(
  clientOrUserId: any,
  maybeUserId?: string | null
): Promise<string | null> {
  const supabase = maybeUserId ? clientOrUserId : createServiceRoleClient();
  const userId = safeTrim(maybeUserId ?? clientOrUserId);
  if (!userId) return null;

  try {
    const { data: existing } = await supabase
      .from("candidate_public_links")
      .select("id, token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.token) return existing.token;
  } catch {}

  try {
    const { data: existingAny } = await supabase
      .from("candidate_public_links")
      .select("id, token")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAny?.token) return existingAny.token;
  } catch {}

  const token = randomToken(24);

  try {
    const { error } = await supabase.from("candidate_public_links").insert({
      user_id: userId,
      token,
      is_active: true,
    });

    if (!error) return token;
  } catch {}

  try {
    const { error } = await supabase.from("candidate_public_links").insert({
      user_id: userId,
      token,
    });

    if (!error) return token;
  } catch {}

  return null;
}

export async function extractStructuredCvFromBuffer(
  input: Buffer | { fileBuffer: Buffer; filename?: string | null; openaiApiKey?: string | null },
  legacyFilename?: string | null
): Promise<{
  text: string;
  structured: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    headline?: string | null;
    summary?: string | null;
    experiences: Array<Record<string, any>>;
    education: Array<Record<string, any>>;
    languages: Array<Record<string, any> | string>;
    skills: string[];
  };
  extracted?: Record<string, any>;
  warnings?: string[];
  cv_sha256?: string;
}> {
  const buffer = Buffer.isBuffer(input) ? input : input?.fileBuffer;
  const filename = Buffer.isBuffer(input) ? legacyFilename : input?.filename;
  let text = "";

  try {
    text = buffer?.toString("utf8") || "";
  } catch {
    text = "";
  }

  const normalizedText = text.replace(/\0/g, " ").replace(/\s+/g, " ").trim();
  const emailMatches = normalizedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phoneMatches = normalizedText.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstNonEmpty = lines[0] || null;

  const structured = {
    full_name: firstNonEmpty,
    email: emailMatches[0] ?? null,
    phone: phoneMatches[0] ?? null,
    location: null,
    headline: filename ?? null,
    summary: null,
    experiences: [],
    education: [],
    languages: [],
    skills: [],
  };

  const warnings: string[] = [];
  if (!normalizedText) warnings.push("empty_cv_text");

  return {
    text: normalizedText,
    structured,
    extracted: structured,
    warnings,
    cv_sha256: buffer ? sha256Hex(buffer) : sha256Hex(""),
  };
}

function normalizeLanguageEntry(lang: any): { language: string; level: string | null } | null {
  if (typeof lang === "string") {
    const language = safeTrim(lang);
    if (!language) return null;
    return { language, level: null };
  }

  if (!lang || typeof lang !== "object") return null;

  const language = safeTrim(lang.language || lang.name || lang.label);
  if (!language) return null;

  const level = safeTrim(lang.level) || null;

  return { language, level };
}

export async function importCandidateLanguages(candidateId: string, parsedPayload: any): Promise<void> {
  const supabase = createServiceRoleClient();

  const rawLanguages = Array.isArray(parsedPayload?.languages) ? parsedPayload.languages : [];
  if (!rawLanguages.length) return;

  const normalized = rawLanguages
    .map(normalizeLanguageEntry)
    .filter(Boolean) as Array<{ language: string; level: string | null }>;

  if (!normalized.length) return;

  const deduped = new Map<string, { language: string; level: string | null }>();
  for (const row of normalized) {
    const key = `${row.language.toLowerCase()}::${(row.level || "").toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, row);
  }

  const rows = Array.from(deduped.values()).map((row) => ({
    user_id: candidateId,
    language: row.language,
    level: row.level,
    source: "cv_parse",
  }));

  try {
    const { error } = await supabase.from("candidate_languages").insert(rows);
    if (!error) return;
  } catch {}

  for (const row of rows) {
    try {
      await supabase.from("candidate_languages").insert(row);
    } catch {}
  }
}

export async function persistImportedCandidateProfile(input: {
  supabase?: any;
  userId: string;
  inviteId?: string | null;
  extracted?: any;
  candidateEmail?: string | null;
  companyName?: string | null;
  mode?: string | null;
  parsedPayload?: any;
  source?: string | null;
}) {
  const supabase = input.supabase || createServiceRoleClient();
  const parsed = input.extracted ?? input.parsedPayload ?? {};

  const fullName = safeTrim(parsed.full_name || parsed.name);
  const headline = safeTrim(parsed.headline || parsed.professional_title);
  const summary = safeTrim(parsed.summary || parsed.about);
  const location = safeTrim(parsed.location || parsed.city);

  try {
    await supabase.from("candidate_profiles").upsert(
      {
        user_id: input.userId,
        full_name: fullName || null,
        headline: headline || null,
        summary: summary || null,
        location: location || null,
        source: input.source ?? input.mode ?? "company_cv_import",
      },
      { onConflict: "user_id" }
    );
  } catch {}

  try {
    const profileFields: Record<string, any> = {
      id: input.userId,
      updated_at: new Date().toISOString(),
    };

    if (fullName) profileFields.full_name = fullName;

    await supabase.from("profiles").upsert(profileFields, { onConflict: "id" });
  } catch {}

  await importCandidateLanguages(input.userId, parsed);

  return {
    success: true,
    mode: input.mode ?? input.source ?? "company_cv_import",
    invite_id: input.inviteId ?? null,
    imported_languages: Array.isArray(parsed?.languages) ? parsed.languages.length : 0,
  };
}
