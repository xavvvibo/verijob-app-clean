import crypto from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { normalizeCvLanguages } from "@/lib/candidate/cv-parse-normalize";
import {
  isReliableCandidateName,
  looksLikeBinaryPdfContent,
  resolveSafeCandidateName,
  sanitizeCandidateText,
} from "@/lib/company-candidate-import-shared";
import { extractStructuredFromCvText } from "@/utils/cv/openaiExtract";
import { extractCvTextFromBuffer } from "@/utils/cv/extractText";

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

function collapseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedBase(value: unknown) {
  return collapseSpaces(String(value || "").toLowerCase())
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:()]+/g, " ");
}

const COMPANY_SUFFIXES = new Set([
  "sl",
  "s.l",
  "s l",
  "sa",
  "s.a",
  "s a",
  "slu",
  "s.l.u",
  "spain",
  "espana",
  "españa",
  "sociedad limitada",
  "sociedad anonima",
]);

function normalizeCompanyOrInstitution(value: unknown) {
  const parts = collapseSpaces(normalizedBase(value)).split(" ").filter(Boolean);
  while (parts.length > 0 && COMPANY_SUFFIXES.has(parts[parts.length - 1])) parts.pop();
  return parts.join(" ");
}

function normalizeRoleOrTitle(value: unknown) {
  return collapseSpaces(normalizedBase(value));
}

function normalizeDateForDb(value: unknown): string | null {
  const raw = safeTrim(value).toLowerCase();
  if (!raw) return null;
  if (raw.includes("actual") || raw.includes("present")) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const y = raw.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return null;
}

function normalizeDateText(value: unknown): string | null {
  const db = normalizeDateForDb(value);
  return db ? db.slice(0, 7) : null;
}

function normalizeMonth(value: unknown) {
  const raw = safeTrim(value);
  if (!raw) return "";
  const ym = raw.match(/^(\d{4})-(\d{2})/);
  if (ym) return `${ym[1]}-${ym[2]}`;
  const y = raw.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01`;
  return raw.toLowerCase();
}

function expExactSig(row: any) {
  return [
    normalizeRoleOrTitle(row?.role_title || row?.title || row?.role),
    normalizeCompanyOrInstitution(row?.company_name || row?.company),
    normalizeMonth(row?.start_date),
    normalizeMonth(row?.end_date),
  ].join("|");
}

function tokenizeText(value: unknown) {
  return normalizedBase(value)
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function jaccardSimilarity(leftValue: unknown, rightValue: unknown) {
  const left = new Set(tokenizeText(leftValue));
  const right = new Set(tokenizeText(rightValue));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function normalizeExtractedExperience(item: any) {
  return {
    company_name: safeTrim(item?.company_name || item?.company) || null,
    role_title: safeTrim(item?.role_title || item?.title || item?.role) || null,
    start_date: normalizeDateForDb(item?.start_date || item?.start),
    end_date: normalizeDateForDb(item?.end_date || item?.end),
    location: safeTrim(item?.location) || null,
    description:
      safeTrim(item?.description) ||
      (Array.isArray(item?.highlights) ? collapseSpaces(item.highlights.join(" · ")) : "") ||
      null,
    skills: Array.isArray(item?.skills) ? item.skills.map((x: any) => safeTrim(x)).filter(Boolean) : [],
  };
}

export function classifyCompanyImportExperienceSuggestion(args: {
  extracted: any;
  existingRows: any[];
  inviteId: string;
  index: number;
}) {
  const normalized = normalizeExtractedExperience(args.extracted);
  const sameCompanyRole = (Array.isArray(args.existingRows) ? args.existingRows : []).filter((row) => {
    return (
      normalizeCompanyOrInstitution(row?.company_name) === normalizeCompanyOrInstitution(normalized.company_name) &&
      normalizeRoleOrTitle(row?.role_title) === normalizeRoleOrTitle(normalized.role_title)
    );
  });

  const exactMatch = sameCompanyRole.find((row) => expExactSig(row) === expExactSig(normalized));
  if (exactMatch) {
    return {
      id: `${args.inviteId}:exp:${args.index}`,
      kind: "duplicate",
      status: "pending",
      reason: "Ya existe una experiencia sustancialmente igual en el perfil.",
      extracted_experience: normalized,
      matched_existing: {
        id: exactMatch?.id ? String(exactMatch.id) : null,
        company_name: safeTrim(exactMatch?.company_name) || null,
        role_title: safeTrim(exactMatch?.role_title) || null,
        start_date: normalizeDateForDb(exactMatch?.start_date),
        end_date: normalizeDateForDb(exactMatch?.end_date),
        description: safeTrim(exactMatch?.description) || null,
      },
    };
  }

  const updateMatch = sameCompanyRole.find((row) => {
    const startMonthMatches = normalizeMonth(row?.start_date) && normalizeMonth(row?.start_date) === normalizeMonth(normalized.start_date);
    const endMonthMatches = normalizeMonth(row?.end_date) && normalizeMonth(row?.end_date) === normalizeMonth(normalized.end_date);
    const similarity = jaccardSimilarity(row?.description, normalized.description);
    return startMonthMatches || endMonthMatches || similarity >= 0.45;
  });

  if (updateMatch) {
    return {
      id: `${args.inviteId}:exp:${args.index}`,
      kind: "update",
      status: "pending",
      reason: "Parece una experiencia existente con información nueva o más completa.",
      extracted_experience: normalized,
      matched_existing: {
        id: updateMatch?.id ? String(updateMatch.id) : null,
        company_name: safeTrim(updateMatch?.company_name) || null,
        role_title: safeTrim(updateMatch?.role_title) || null,
        start_date: normalizeDateForDb(updateMatch?.start_date),
        end_date: normalizeDateForDb(updateMatch?.end_date),
        description: safeTrim(updateMatch?.description) || null,
      },
    };
  }

  return {
    id: `${args.inviteId}:exp:${args.index}`,
    kind: "new",
    status: "pending",
    reason: "No existe una experiencia equivalente en el perfil actual.",
    extracted_experience: normalized,
    matched_existing: null,
  };
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
      .select("id, public_token, expires_at")
      .eq("candidate_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.public_token) return existing.public_token;
  } catch {}

  try {
    const { data: existingAny } = await supabase
      .from("candidate_public_links")
      .select("id, public_token")
      .eq("candidate_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAny?.public_token) return existingAny.public_token;
  } catch {}

  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { error } = await supabase.from("candidate_public_links").insert({
      candidate_id: userId,
      public_token: token,
      is_active: true,
      created_by: userId,
      expires_at: expiresAt,
    });

    if (!error) return token;
  } catch {}

  try {
    const { error } = await supabase.from("candidate_public_links").insert({
      candidate_id: userId,
      public_token: token,
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
  const openaiApiKey = Buffer.isBuffer(input) ? null : safeTrim(input?.openaiApiKey);
  let text = "";
  let structuredFromLlm: any = null;

  try {
    text = buffer ? await extractCvTextFromBuffer(buffer, filename || undefined) : "";
  } catch {
    text = "";
  }

  const normalizedText = sanitizeCandidateText(text);
  const emailMatches = normalizedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phoneMatches = normalizedText.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidateLines = lines.filter((line) => {
    if (!line) return false;
    if (looksLikeBinaryPdfContent(line)) return false;
    if (line.includes("@")) return false;
    if (/\+?\d[\d\s().-]{7,}\d/.test(line)) return false;
    if (/curriculum|cv|resume/i.test(line) && line.split(" ").length <= 3) return false;
    return true;
  });

  if (normalizedText && openaiApiKey) {
    try {
      const llm = await extractStructuredFromCvText(normalizedText);
      structuredFromLlm = llm?.result && typeof llm.result === "object" ? llm.result : null;
    } catch {
      structuredFromLlm = null;
    }
  }

  const extractedName = structuredFromLlm?.full_name ?? candidateLines[0] ?? null;
  const safeName = resolveSafeCandidateName(extractedName, emailMatches[0] || null);

  const structured = {
    full_name: isReliableCandidateName(extractedName) ? sanitizeCandidateText(extractedName) : null,
    display_name: safeName,
    email: safeTrim(structuredFromLlm?.email) || emailMatches[0] || null,
    phone: safeTrim(structuredFromLlm?.phone) || phoneMatches[0] || null,
    location: safeTrim(structuredFromLlm?.location) || null,
    headline: safeTrim(structuredFromLlm?.headline) || null,
    summary: safeTrim(structuredFromLlm?.summary) || null,
    experiences: Array.isArray(structuredFromLlm?.experience)
      ? structuredFromLlm.experience.map((item: any) => ({
          company_name: safeTrim(item?.company) || null,
          role_title: safeTrim(item?.role) || null,
          start_date: normalizeDateForDb(item?.start),
          end_date: normalizeDateForDb(item?.end),
          location: safeTrim(item?.location) || null,
          description: Array.isArray(item?.highlights) ? collapseSpaces(item.highlights.join(" · ")) || null : null,
        }))
      : [],
    education: Array.isArray(structuredFromLlm?.education)
      ? structuredFromLlm.education.map((item: any) => ({
          institution: safeTrim(item?.institution) || null,
          title: safeTrim(item?.degree) || null,
          start_date: normalizeDateText(item?.start),
          end_date: normalizeDateText(item?.end),
          description: safeTrim(item?.notes) || null,
        }))
      : [],
    languages: normalizeCvLanguages(Array.isArray(structuredFromLlm?.languages) ? structuredFromLlm.languages : [], 30, normalizedText),
    skills: Array.isArray(structuredFromLlm?.skills)
      ? structuredFromLlm.skills.map((item: any) => safeTrim(item)).filter(Boolean)
      : [],
  };

  const warnings: string[] = [];
  if (!normalizedText) warnings.push("empty_cv_text");
  if (!isReliableCandidateName(extractedName)) warnings.push("unreliable_candidate_name");

  return {
    text: normalizedText,
    structured,
    extracted: structured,
    warnings,
    cv_sha256: buffer ? sha256Hex(buffer) : sha256Hex(""),
  };
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
  const mode = input.mode === "existing_candidate" ? "existing_candidate" : "new_candidate";
  const importedAt = new Date().toISOString();
  const [candidateProfileRes, profileRes, experiencesRes] = await Promise.all([
    supabase
      .from("candidate_profiles")
      .select("id,user_id,raw_cv_json")
      .eq("user_id", input.userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id,full_name,email,title,location")
      .eq("id", input.userId)
      .maybeSingle(),
    supabase
      .from("profile_experiences")
      .select("id,company_name,role_title,start_date,end_date,description")
      .eq("user_id", input.userId),
  ]);
  const currentProfile = profileRes.data || {};
  const currentExperiences = Array.isArray(experiencesRes.data) ? experiencesRes.data : [];
  const currentRawCvJson =
    candidateProfileRes.data?.raw_cv_json && typeof candidateProfileRes.data.raw_cv_json === "object"
      ? candidateProfileRes.data.raw_cv_json
      : {};
  const importedLanguages = normalizeCvLanguages(
    Array.isArray(parsed?.languages) ? parsed.languages : [],
    50,
    safeTrim(parsed?.summary || parsed?.raw_text || parsed?.cv_text || parsed?.text)
  );
  const mergedLanguages = Array.from(new Set([...importedLanguages]));
  const newLanguages = mergedLanguages.filter((language) => {
    return Boolean(language);
  });
  const existingValidName = isReliableCandidateName((currentProfile as any)?.full_name)
    ? sanitizeCandidateText((currentProfile as any)?.full_name)
    : null;
  const importedValidName = isReliableCandidateName(parsed?.full_name || parsed?.name)
    ? sanitizeCandidateText(parsed?.full_name || parsed?.name)
    : null;
  const experienceRows = Array.isArray(parsed?.experiences) ? parsed.experiences : [];
  const suggestions = experienceRows.map((row: any, index: number) =>
    classifyCompanyImportExperienceSuggestion({
      extracted: row,
      existingRows: currentExperiences,
      inviteId: String(input.inviteId || "company-cv-import"),
      index,
    })
  );
  const updateEntry = {
    invite_id: input.inviteId ?? null,
    imported_at: importedAt,
    company_name: input.companyName ?? null,
    mode,
    candidate_identity: {
      email: input.candidateEmail ?? currentProfile?.email ?? null,
      display_name: resolveSafeCandidateName(importedValidName || parsed?.display_name || parsed?.full_name || parsed?.name, input.candidateEmail ?? currentProfile?.email),
      reliable_name: importedValidName,
      existing_candidate: mode === "existing_candidate",
    },
    profile_proposal: {
      full_name: existingValidName || importedValidName || null,
      full_name_source: existingValidName ? "existing_profile" : importedValidName ? "imported_cv" : "fallback",
      headline: safeTrim((currentProfile as any)?.title) || safeTrim(parsed?.headline || parsed?.professional_title) || null,
      location: safeTrim((currentProfile as any)?.location) || safeTrim(parsed?.location || parsed?.city) || null,
      merged_languages: mergedLanguages,
      new_languages: newLanguages,
      detected_languages_count: importedLanguages.length,
      summary: safeTrim(parsed?.summary || parsed?.about) || null,
    },
    experience_suggestions: suggestions,
  };
  const previousUpdates = Array.isArray((currentRawCvJson as any)?.company_cv_import_updates)
    ? (currentRawCvJson as any).company_cv_import_updates
    : [];
  const nextUpdates = [
    updateEntry,
    ...previousUpdates.filter((entry: any) => String(entry?.invite_id || "") !== String(input.inviteId || "")),
  ];
  const nextRawCvJson = {
    ...(currentRawCvJson || {}),
    company_cv_import: {
      source: mode,
      invite_id: input.inviteId ?? null,
      imported_at: importedAt,
      candidate_email: input.candidateEmail ?? null,
      company_name: input.companyName ?? null,
      extracted_payload: parsed,
      staged_only: true,
      profile_proposal: updateEntry.profile_proposal,
    },
    company_cv_import_updates: nextUpdates,
  };

  await supabase.from("candidate_profiles").upsert(
    {
      user_id: input.userId,
      raw_cv_json: nextRawCvJson,
      updated_at: importedAt,
    },
    { onConflict: "user_id" }
  );

  return {
    success: true,
    mode,
    invite_id: input.inviteId ?? null,
    staged_only: true,
    imported_experiences: 0,
    imported_education: 0,
    imported_languages: 0,
    pending_experience_suggestions: suggestions.filter((item: any) => String(item?.status || "pending") === "pending").length,
  };
}
