import crypto from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { normalizeCvLanguages, selectLanguagesPersistenceTarget } from "@/lib/candidate/cv-parse-normalize";

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

function expPossibleSig(row: any) {
  return [
    normalizeRoleOrTitle(row?.role_title || row?.title || row?.role),
    normalizeCompanyOrInstitution(row?.company_name || row?.company),
  ].join("|");
}

function eduExactSig(row: any) {
  return [
    normalizeRoleOrTitle(row?.title || row?.degree),
    normalizeCompanyOrInstitution(row?.institution),
    normalizeMonth(row?.start_date || row?.start),
    normalizeMonth(row?.end_date || row?.end),
  ].join("|");
}

async function getTableColumns(supabase: any, table: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", table);
    if (error || !Array.isArray(data)) return new Set();
    return new Set(data.map((row: any) => String(row?.column_name || "").trim()).filter(Boolean));
  } catch {
    return new Set();
  }
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

async function persistImportedExperiences(params: {
  supabase: any;
  userId: string;
  inviteId?: string | null;
  rawExperiences: any[];
}) {
  const { supabase, userId, inviteId, rawExperiences } = params;
  const rows = (Array.isArray(rawExperiences) ? rawExperiences : [])
    .map((item: any) => {
      const roleTitle = safeTrim(item?.role_title || item?.title || item?.role);
      const companyName = safeTrim(item?.company_name || item?.company);
      const startDate = normalizeDateForDb(item?.start_date || item?.start);
      const endDate = normalizeDateForDb(item?.end_date || item?.end);
      const description = safeTrim(item?.description) || (Array.isArray(item?.highlights) ? collapseSpaces(item.highlights.join(" · ")) : "");
      if (!roleTitle || !companyName || !startDate) return null;
      return {
        user_id: userId,
        role_title: roleTitle,
        company_name: companyName,
        start_date: startDate,
        end_date: endDate,
        description: description || null,
        matched_verification_id: null,
        confidence: null,
      };
    })
    .filter(Boolean) as any[];

  if (!rows.length) return { imported: 0 };

  const [profileExpColumns, existingRes] = await Promise.all([
    getTableColumns(supabase, "profile_experiences"),
    supabase
      .from("profile_experiences")
      .select("role_title,company_name,start_date,end_date")
      .eq("user_id", userId),
  ]);

  const existingRows = Array.isArray(existingRes.data) ? existingRes.data : [];
  const exactSet = new Set(existingRows.map((row: any) => expExactSig(row)));
  const possibleSet = new Set(existingRows.map((row: any) => expPossibleSig(row)));
  const importedAtIso = new Date().toISOString();
  const toInsert: any[] = [];

  for (const row of rows) {
    const exact = expExactSig(row);
    const possible = expPossibleSig(row);
    if (exactSet.has(exact) || possibleSet.has(possible)) continue;
    exactSet.add(exact);
    possibleSet.add(possible);

    const nextRow: any = { ...row };
    if (profileExpColumns.has("import_source")) nextRow.import_source = "company_cv_import";
    if (profileExpColumns.has("import_job_id") && inviteId) nextRow.import_job_id = inviteId;
    if (profileExpColumns.has("imported_at")) nextRow.imported_at = importedAtIso;
    if (profileExpColumns.has("metadata")) {
      nextRow.metadata = {
        import_source: "company_cv_import",
        invite_id: inviteId || null,
        imported_at: importedAtIso,
      };
    }
    toInsert.push(nextRow);
  }

  if (!toInsert.length) return { imported: 0 };
  const { error } = await supabase.from("profile_experiences").insert(toInsert);
  if (error) throw error;
  return { imported: toInsert.length };
}

async function persistImportedEducation(params: {
  supabase: any;
  userId: string;
  inviteId?: string | null;
  rawEducation: any[];
}) {
  const { supabase, userId, inviteId, rawEducation } = params;
  const normalized = (Array.isArray(rawEducation) ? rawEducation : [])
    .map((item: any) => {
      const title = safeTrim(item?.title || item?.degree);
      const institution = safeTrim(item?.institution);
      const description = safeTrim(item?.description || item?.notes);
      if (!title && !institution && !description) return null;
      return {
        title,
        institution,
        start_date: normalizeDateText(item?.start_date || item?.start),
        end_date: normalizeDateText(item?.end_date || item?.end),
        description: description || null,
        import_source: "company_cv_import",
        import_job_id: inviteId || null,
        imported_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as any[];

  if (!normalized.length) return { imported: 0 };

  const { data: candidateProfile } = await supabase
    .from("candidate_profiles")
    .select("id,user_id,education")
    .eq("user_id", userId)
    .maybeSingle();

  const currentEducation = Array.isArray(candidateProfile?.education) ? candidateProfile.education : [];
  const exactSet = new Set(currentEducation.map((row: any) => eduExactSig(row)));
  const possibleSet = new Set(
    currentEducation.map((row: any) => `${normalizeRoleOrTitle(row?.title)}|${normalizeCompanyOrInstitution(row?.institution)}`)
  );
  const toAppend: any[] = [];

  for (const row of normalized) {
    const exact = eduExactSig(row);
    const possible = `${normalizeRoleOrTitle(row?.title)}|${normalizeCompanyOrInstitution(row?.institution)}`;
    if (exactSet.has(exact) || possibleSet.has(possible)) continue;
    exactSet.add(exact);
    possibleSet.add(possible);
    toAppend.push(row);
  }

  if (!toAppend.length) return { imported: 0 };

  const payload = {
    user_id: userId,
    education: [...currentEducation, ...toAppend],
    updated_at: new Date().toISOString(),
  };

  const { error } = candidateProfile?.id
    ? await supabase.from("candidate_profiles").update(payload).eq("id", candidateProfile.id)
    : await supabase.from("candidate_profiles").insert(payload);
  if (error) throw error;
  return { imported: toAppend.length };
}

async function persistImportedLanguagesToProfile(params: {
  supabase: any;
  userId: string;
  inviteId?: string | null;
  rawLanguages: any[];
}) {
  const { supabase, userId, inviteId, rawLanguages } = params;
  const normalizedList = normalizeCvLanguages(rawLanguages, 50);
  const languageEntries = (Array.isArray(rawLanguages) ? rawLanguages : [])
    .map(normalizeLanguageEntry)
    .filter(Boolean) as Array<{ language: string; level: string | null }>;

  if (!normalizedList.length && !languageEntries.length) return { imported: 0 };

  const [profileColumns, candidateProfileColumns, profileRes, candidateProfileRes] = await Promise.all([
    getTableColumns(supabase, "profiles"),
    getTableColumns(supabase, "candidate_profiles"),
    supabase.from("profiles").select("id,languages").eq("id", userId).maybeSingle(),
    supabase.from("candidate_profiles").select("id,user_id,achievements,other_achievements").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileColumns.has("languages")) {
    const currentLanguages = Array.isArray(profileRes.data?.languages)
      ? profileRes.data.languages.map((item: any) => safeTrim(item)).filter(Boolean)
      : [];
    const seen = new Set(currentLanguages.map((item: string) => item.toLowerCase()));
    const toAppend = normalizedList.filter((item: string) => !seen.has(item.toLowerCase()));
    if (toAppend.length) {
      const { error } = await supabase
        .from("profiles")
        .update({
          languages: [...currentLanguages, ...toAppend],
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) throw error;
    }
  }

  const persistenceTarget = selectLanguagesPersistenceTarget(profileColumns, candidateProfileColumns);
  if (persistenceTarget === "skip") {
    return { imported: normalizedList.length };
  }

  const targetColumn = persistenceTarget === "candidate_profiles.other_achievements" ? "other_achievements" : "achievements";
  const currentAchievements = Array.isArray((candidateProfileRes.data as any)?.[targetColumn])
    ? (candidateProfileRes.data as any)[targetColumn]
    : [];
  const seenAchievementKeys = new Set(
    currentAchievements
      .filter((item: any) => String(item?.category || "").toLowerCase() === "idioma")
      .map((item: any) => `${safeTrim(item?.language || item?.title).toLowerCase()}::${safeTrim(item?.level).toLowerCase()}`)
  );

  const nowIso = new Date().toISOString();
  const toAppendAchievements = (languageEntries.length ? languageEntries : normalizedList.map((language) => ({ language, level: null })))
    .filter((item) => item.language)
    .filter((item) => {
      const key = `${item.language.toLowerCase()}::${(item.level || "").toLowerCase()}`;
      if (seenAchievementKeys.has(key)) return false;
      seenAchievementKeys.add(key);
      return true;
    })
    .map((item) => ({
      title: item.language,
      language: item.language,
      level: item.level || null,
      category: "idioma",
      issuer: null,
      date: null,
      description: "Idioma detectado en CV importado por empresa",
      import_source: "company_cv_import",
      import_job_id: inviteId || null,
      imported_at: nowIso,
    }));

  if (toAppendAchievements.length) {
    const payload = {
      user_id: userId,
      [targetColumn]: [...currentAchievements, ...toAppendAchievements],
      updated_at: nowIso,
    };
    const { error } = candidateProfileRes.data
      ? await supabase.from("candidate_profiles").update(payload).eq("user_id", userId)
      : await supabase.from("candidate_profiles").insert(payload);
    if (error) throw error;
  }

  return { imported: toAppendAchievements.length || normalizedList.length };
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
  const mode = input.mode ?? input.source ?? "company_cv_import";

  const fullName = safeTrim(parsed.full_name || parsed.name);
  const headline = safeTrim(parsed.headline || parsed.professional_title);
  const summary = safeTrim(parsed.summary || parsed.about);
  const location = safeTrim(parsed.location || parsed.city);
  const importedAt = new Date().toISOString();
  const candidateProfileRes = await supabase
    .from("candidate_profiles")
    .select("id,user_id,raw_cv_json")
    .eq("user_id", input.userId)
    .maybeSingle();
  const currentRawCvJson =
    candidateProfileRes.data?.raw_cv_json && typeof candidateProfileRes.data.raw_cv_json === "object"
      ? candidateProfileRes.data.raw_cv_json
      : {};
  const nextRawCvJson = {
    ...(currentRawCvJson || {}),
    company_cv_import: {
      source: mode,
      invite_id: input.inviteId ?? null,
      imported_at: importedAt,
      candidate_email: input.candidateEmail ?? null,
      company_name: input.companyName ?? null,
      extracted_payload: parsed,
    },
  };

  try {
    await supabase.from("candidate_profiles").upsert(
      {
        user_id: input.userId,
        full_name: fullName || null,
        headline: headline || null,
        summary: summary || null,
        location: location || null,
        source: mode,
        raw_cv_json: nextRawCvJson,
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

  let importedExperiences = 0;
  let importedEducation = 0;
  let importedLanguages = 0;

  if (mode !== "existing_candidate") {
    try {
      const experienceResult = await persistImportedExperiences({
        supabase,
        userId: input.userId,
        inviteId: input.inviteId,
        rawExperiences: Array.isArray(parsed?.experiences) ? parsed.experiences : [],
      });
      importedExperiences = Number(experienceResult.imported || 0);
    } catch {}

    try {
      const educationResult = await persistImportedEducation({
        supabase,
        userId: input.userId,
        inviteId: input.inviteId,
        rawEducation: Array.isArray(parsed?.education) ? parsed.education : [],
      });
      importedEducation = Number(educationResult.imported || 0);
    } catch {}

    try {
      const languageResult = await persistImportedLanguagesToProfile({
        supabase,
        userId: input.userId,
        inviteId: input.inviteId,
        rawLanguages: Array.isArray(parsed?.languages) ? parsed.languages : [],
      });
      importedLanguages = Number(languageResult.imported || 0);
    } catch {}
  } else {
    await importCandidateLanguages(input.userId, parsed);
  }

  return {
    success: true,
    mode,
    invite_id: input.inviteId ?? null,
    imported_experiences: importedExperiences,
    imported_education: importedEducation,
    imported_languages: importedLanguages || (Array.isArray(parsed?.languages) ? parsed.languages.length : 0),
  };
}
