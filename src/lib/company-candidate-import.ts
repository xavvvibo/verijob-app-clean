import { createHash, randomBytes } from "crypto";
import { extractCvTextFromBuffer } from "@/utils/cv/extractText";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import {
  normalizeCvLanguages,
  selectLanguagesPersistenceTarget,
  shouldImportEducationRow,
} from "@/lib/candidate/cv-parse-normalize";

export const COMPANY_CV_IMPORT_LEGAL_VERSION = "company_cv_import_v1_2026_03_13";

type ExtractedExperience = {
  company_name?: string | null;
  role_title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  description?: string | null;
  skills?: string[];
  confidence?: number | null;
};

type ExtractedEducation = {
  institution?: string | null;
  title?: string | null;
  study_field?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  confidence?: number | null;
};

export type ExtractedCandidateCvPayload = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  headline?: string | null;
  languages?: string[];
  experiences?: ExtractedExperience[];
  education?: ExtractedEducation[];
};

export type CompanyCvExperienceSuggestion = {
  id: string;
  kind: "duplicate" | "new" | "update";
  reason: string;
  status: "pending" | "accepted" | "dismissed";
  extracted_experience: {
    company_name: string | null;
    role_title: string | null;
    start_date: string | null;
    end_date: string | null;
    location: string | null;
    description: string | null;
    skills: string[];
  };
  matched_existing: null | {
    id: string | null;
    company_name: string | null;
    role_title: string | null;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
  };
};

function normalizeText(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function toNullable(v: any) {
  const s = normalizeText(v);
  return s ? s : null;
}

function normalizeDateForDb(v: any): string | null {
  const s = normalizeText(v).toLowerCase();
  if (!s) return null;
  if (s.includes("actual") || s.includes("present")) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ym = s.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const y = s.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return null;
}

function normalizeDateText(v: any): string | null {
  const db = normalizeDateForDb(v);
  return db ? db.slice(0, 7) : null;
}

function collapseSpaces(v: string) {
  return v.replace(/\s+/g, " ").trim();
}

function normalizedBase(v: any) {
  return collapseSpaces(String(v || "").toLowerCase()).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function normalizeCompanyOrInstitution(v: any) {
  const base = normalizedBase(v).replace(/[.,;:()]+/g, " ");
  const parts = collapseSpaces(base).split(" ").filter(Boolean);
  while (parts.length > 0 && COMPANY_SUFFIXES.has(parts[parts.length - 1])) parts.pop();
  return parts.join(" ");
}

function normalizeRoleOrTitle(v: any) {
  return collapseSpaces(normalizedBase(v).replace(/[.,;:()]+/g, " "));
}

function normalizeMonth(v: any) {
  const s = normalizeText(v);
  if (!s) return "";
  const ym = s.match(/^(\d{4})-(\d{2})/);
  if (ym) return `${ym[1]}-${ym[2]}`;
  const y = s.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01`;
  return s.toLowerCase();
}

function expExactSig(row: any) {
  return `${normalizeRoleOrTitle(row?.role_title || row?.title)}|${normalizeCompanyOrInstitution(row?.company_name || row?.company)}|${normalizeMonth(row?.start_date)}|${normalizeMonth(row?.end_date)}`;
}

function expPossibleSig(row: any) {
  return `${normalizeRoleOrTitle(row?.role_title || row?.title)}|${normalizeCompanyOrInstitution(row?.company_name || row?.company)}`;
}

function eduExactSig(row: any) {
  return `${normalizeRoleOrTitle(row?.title || row?.degree)}|${normalizeCompanyOrInstitution(row?.institution)}|${normalizeMonth(row?.start_date || row?.start)}|${normalizeMonth(row?.end_date || row?.end)}`;
}

function buildCvExtractionPrompt(cvText: string) {
  return [
    "Extrae informacion estructurada de este CV en JSON valido.",
    "No inventes datos. Si no existe un campo, usa null o array vacio.",
    "Debes separar experiencia laboral y formacion academica.",
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
        if (part?.type === "output_text" && typeof part?.text === "string" && part.text.trim()) return part.text.trim();
      }
    }
  }
  return "";
}

function normalizeExtract(raw: any): ExtractedCandidateCvPayload {
  const experiences = Array.isArray(raw?.experiences) ? raw.experiences : [];
  const education = Array.isArray(raw?.education) ? raw.education : [];
  const languages = normalizeCvLanguages(Array.isArray(raw?.languages) ? raw.languages : [], 30);
  return {
    full_name: toNullable(raw?.full_name),
    email: toNullable(raw?.email),
    phone: toNullable(raw?.phone),
    headline: toNullable(raw?.headline),
    languages,
    experiences: experiences.map((x: any) => ({
      company_name: toNullable(x?.company_name),
      role_title: toNullable(x?.role_title),
      start_date: toNullable(x?.start_date),
      end_date: toNullable(x?.end_date),
      location: toNullable(x?.location),
      description: toNullable(x?.description),
      skills: Array.isArray(x?.skills) ? x.skills.map((item: any) => String(item || "").trim()).filter(Boolean) : [],
      confidence: typeof x?.confidence === "number" ? x.confidence : null,
    })),
    education: education.map((x: any) => ({
      institution: toNullable(x?.institution),
      title: toNullable(x?.title),
      study_field: toNullable(x?.study_field),
      start_date: toNullable(x?.start_date),
      end_date: toNullable(x?.end_date),
      description: toNullable(x?.description),
      confidence: typeof x?.confidence === "number" ? x.confidence : null,
    })),
  };
}

function buildWarnings(input: { cvText: string; experiences: any[]; education: any[]; languages?: string[] }) {
  const warnings: string[] = [];
  const plain = input.cvText.replace(/\s+/g, " ").trim();
  const wordCount = plain ? plain.split(" ").length : 0;
  if (plain.length < 400 || wordCount < 80) warnings.push("cv_text_insufficient");
  if ((input.experiences || []).length === 0) warnings.push("no_experiences_detected");
  if ((input.education || []).length === 0) warnings.push("no_education_detected");
  if (!Array.isArray(input.languages) || input.languages.length === 0) warnings.push("no_languages_detected");
  return warnings;
}

function tokenizeText(value: unknown) {
  return normalizedBase(value)
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function jaccardSimilarity(a: unknown, b: unknown) {
  const left = new Set(tokenizeText(a));
  const right = new Set(tokenizeText(b));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function normalizeExperienceForSuggestion(item: any) {
  return {
    company_name: toNullable(item?.company_name),
    role_title: toNullable(item?.role_title),
    start_date: normalizeDateForDb(item?.start_date),
    end_date: normalizeDateForDb(item?.end_date),
    location: toNullable(item?.location),
    description: toNullable(item?.description),
    skills: Array.isArray(item?.skills) ? item.skills.map((x: any) => String(x || "").trim()).filter(Boolean) : [],
  };
}

function buildExperienceSuggestion(params: {
  extracted: any;
  existingRows: any[];
  inviteId: string;
  index: number;
}): CompanyCvExperienceSuggestion {
  const extracted = normalizeExperienceForSuggestion(params.extracted);
  const sameCompanyRole = params.existingRows.filter((row: any) => {
    return (
      normalizeCompanyOrInstitution(row?.company_name) === normalizeCompanyOrInstitution(extracted.company_name) &&
      normalizeRoleOrTitle(row?.role_title) === normalizeRoleOrTitle(extracted.role_title)
    );
  });

  const exactMatch = sameCompanyRole.find((row: any) => expExactSig(row) === expExactSig(extracted));
  if (exactMatch) {
    return {
      id: `${params.inviteId}:exp:${params.index}`,
      kind: "duplicate",
      reason: "Ya existe una experiencia sustancialmente igual en tu perfil.",
      status: "pending",
      extracted_experience: extracted,
      matched_existing: {
        id: exactMatch?.id ? String(exactMatch.id) : null,
        company_name: toNullable(exactMatch?.company_name),
        role_title: toNullable(exactMatch?.role_title),
        start_date: normalizeDateForDb(exactMatch?.start_date),
        end_date: normalizeDateForDb(exactMatch?.end_date),
        description: toNullable(exactMatch?.description),
      },
    };
  }

  const updateMatch = sameCompanyRole.find((row: any) => {
    const startMonthMatches = normalizeMonth(row?.start_date) && normalizeMonth(row?.start_date) === normalizeMonth(extracted.start_date);
    const endMonthMatches = normalizeMonth(row?.end_date) && normalizeMonth(row?.end_date) === normalizeMonth(extracted.end_date);
    const descriptionSimilarity = jaccardSimilarity(row?.description, extracted.description);
    return startMonthMatches || endMonthMatches || descriptionSimilarity >= 0.45;
  });

  if (updateMatch) {
    return {
      id: `${params.inviteId}:exp:${params.index}`,
      kind: "update",
      reason: "Parece una experiencia ya existente con posible información nueva o más completa.",
      status: "pending",
      extracted_experience: extracted,
      matched_existing: {
        id: updateMatch?.id ? String(updateMatch.id) : null,
        company_name: toNullable(updateMatch?.company_name),
        role_title: toNullable(updateMatch?.role_title),
        start_date: normalizeDateForDb(updateMatch?.start_date),
        end_date: normalizeDateForDb(updateMatch?.end_date),
        description: toNullable(updateMatch?.description),
      },
    };
  }

  return {
    id: `${params.inviteId}:exp:${params.index}`,
    kind: "new",
    reason: "No existe una experiencia equivalente en tu perfil actual.",
    status: "pending",
    extracted_experience: extracted,
    matched_existing: null,
  };
}

async function getTableColumns(supabase: any, table: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", table);
    if (error || !Array.isArray(data)) return new Set();
    return new Set(data.map((row: any) => String(row?.column_name || "")).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function persistLanguagesFromExtract(params: {
  supabase: any;
  userId: string;
  inviteId: string;
  languagesRaw: any[];
}) {
  const { supabase, userId, inviteId, languagesRaw } = params;
  const normalizedLanguages = normalizeCvLanguages(
    (Array.isArray(languagesRaw) ? languagesRaw : []).map((x: any) => normalizeText(x).trim()),
    50
  );
  if (normalizedLanguages.length === 0) return { imported: 0, duplicatesSkipped: 0 };

  const [profileColumns, profileRes, cpRes] = await Promise.all([
    getTableColumns(supabase, "profiles"),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const persistenceTarget = selectLanguagesPersistenceTarget(profileColumns);
  if (persistenceTarget === "profiles.languages" && profileColumns.has("languages")) {
    const current = Array.isArray((profileRes.data as any)?.languages)
      ? (profileRes.data as any).languages.map((x: any) => normalizeText(x)).filter(Boolean)
      : [];
    const currentSet = new Set(current.map((x: string) => x.toLowerCase()));
    const toAppend = normalizedLanguages.filter((lang: string) => !currentSet.has(lang.toLowerCase()));
    if (toAppend.length > 0) {
      await supabase
        .from("profiles")
        .update({ languages: [...current, ...toAppend], updated_at: new Date().toISOString() })
        .eq("id", userId);
    }
    return { imported: toAppend.length, duplicatesSkipped: normalizedLanguages.length - toAppend.length };
  }

  const currentAchievements = Array.isArray((cpRes.data as any)?.achievements) ? (cpRes.data as any).achievements : [];
  const currentSet = new Set(
    currentAchievements
      .filter((x: any) => String(x?.category || "").toLowerCase() === "idioma")
      .map((x: any) => normalizeText(x?.title).toLowerCase())
      .filter(Boolean)
  );
  const toAppend = normalizedLanguages.filter((lang: string) => !currentSet.has(lang.toLowerCase()));
  if (toAppend.length > 0) {
    const nowIso = new Date().toISOString();
    const merged = [
      ...currentAchievements,
      ...toAppend.map((lang: string) => ({
        title: lang,
        category: "idioma",
        description: null,
        import_source: "company_cv_import",
        import_invite_id: inviteId,
        imported_at: nowIso,
      })),
    ];
    const payload = {
      user_id: userId,
      achievements: merged,
      updated_at: nowIso,
    };
    if (cpRes.data) await supabase.from("candidate_profiles").update(payload).eq("user_id", userId);
    else await supabase.from("candidate_profiles").insert(payload);
  }
  return { imported: toAppend.length, duplicatesSkipped: normalizedLanguages.length - toAppend.length };
}

export function sha256Hex(input: Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

export async function ensureCandidatePublicToken(admin: any, userId: string) {
  const { data, error } = await admin
    .from("candidate_public_links")
    .select("id,public_token,expires_at,is_active,created_at")
    .eq("candidate_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`candidate_public_links_read_failed:${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  const canonical = rows.find((row: any) => /^[a-f0-9]{48}$/i.test(String(row?.public_token || "")) && row?.expires_at && Date.parse(String(row.expires_at)) > Date.now()) || rows.find((row: any) => /^[a-f0-9]{48}$/i.test(String(row?.public_token || "")));
  if (canonical?.public_token) {
    const toDeactivate = rows
      .filter((row: any) => String(row?.id || "") && String(row?.id || "") !== String(canonical.id || ""))
      .map((row: any) => String(row.id));
    if (toDeactivate.length) await admin.from("candidate_public_links").update({ is_active: false }).in("id", toDeactivate);
    return String(canonical.public_token);
  }

  const activeIds = rows.map((row: any) => String(row?.id || "")).filter(Boolean);
  if (activeIds.length) await admin.from("candidate_public_links").update({ is_active: false }).in("id", activeIds);

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertErr } = await admin.from("candidate_public_links").insert({
    candidate_id: userId,
    public_token: token,
    is_active: true,
    created_by: userId,
    expires_at: expiresAt,
  });
  if (insertErr) throw new Error(`candidate_public_links_insert_failed:${insertErr.message}`);
  return token;
}

export async function extractStructuredCvFromBuffer(params: {
  fileBuffer: Buffer;
  filename: string;
  openaiApiKey: string;
}) {
  const { fileBuffer, filename, openaiApiKey } = params;
  const cvText = (await extractCvTextFromBuffer(fileBuffer, filename)).trim();
  if (!cvText) throw new Error("empty_cv_text");
  const prompt = buildCvExtractionPrompt(cvText.slice(0, 120000));
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: { format: { type: "json_object" } },
      temperature: 0,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`openai_response_failed_${resp.status}:${text.slice(0, 300)}`);
  }
  const raw = await resp.json();
  const outputText = readResponseOutputText(raw);
  if (!outputText) throw new Error("openai_no_output_text");
  const parsed = JSON.parse(outputText);
  const normalized = normalizeExtract(parsed);
  const warnings = buildWarnings({
    cvText,
    experiences: normalized.experiences || [],
    education: normalized.education || [],
    languages: normalized.languages || [],
  });
  return {
    extracted: normalized,
    warnings,
    textLength: cvText.length,
    cv_sha256: sha256Hex(fileBuffer),
  };
}

export function buildCompanyCvImportLegalSnapshot(params: {
  companyName: string;
  candidateEmail: string;
  targetRole?: string | null;
}) {
  const companyName = resolveCompanyDisplayName(params.companyName, "Tu empresa");
  const candidateEmail = String(params.candidateEmail || "").trim();
  const targetRole = String(params.targetRole || "").trim() || null;
  return {
    version: COMPANY_CV_IMPORT_LEGAL_VERSION,
    source_flow: "company_cv_import",
    company_name: companyName,
    candidate_email: candidateEmail,
    target_role: targetRole,
    statements: [
      `Declaro que he entregado voluntariamente mi CV a ${companyName} en el contexto de un proceso de seleccion.`,
      `Acepto que ${companyName} gestione mi candidatura mediante VERIJOB y que los datos contenidos en mi CV sean importados y estructurados para completar mi perfil profesional.`,
      "Entiendo que podre revisar, corregir y completar mi informacion antes de publicarla o verificarla.",
    ],
  };
}

export async function persistImportedCandidateProfile(params: {
  supabase: any;
  userId: string;
  inviteId: string;
  extracted: ExtractedCandidateCvPayload;
  candidateEmail: string;
  companyName?: string | null;
  mode?: "new_candidate" | "existing_candidate";
}) {
  const { supabase, userId, inviteId, extracted, candidateEmail } = params;
  const nowIso = new Date().toISOString();
  const mode = params.mode === "existing_candidate" ? "existing_candidate" : "new_candidate";

  const [profileColumns, existingProfileRes, cpRes, existingExperienceRes, profileExpColumns] = await Promise.all([
    getTableColumns(supabase, "profiles"),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_experiences").select("id,role_title,company_name,start_date,end_date,description").eq("user_id", userId),
    getTableColumns(supabase, "profile_experiences"),
  ]);

  const profilePatch: Record<string, any> = {
    id: userId,
    updated_at: nowIso,
  };
  if (!normalizeText((existingProfileRes.data as any)?.full_name) && extracted.full_name) profilePatch.full_name = extracted.full_name;
  if (!normalizeText((existingProfileRes.data as any)?.title) && extracted.headline) profilePatch.title = extracted.headline;
  if (profileColumns.has("phone") && !normalizeText((existingProfileRes.data as any)?.phone) && extracted.phone) profilePatch.phone = extracted.phone;
  if (profileColumns.has("email") && !normalizeText((existingProfileRes.data as any)?.email) && candidateEmail) profilePatch.email = candidateEmail;
  await supabase.from("profiles").upsert(profilePatch, { onConflict: "id" });

  const currentCp = (cpRes.data as any) || null;
  const existingRawCvJson = currentCp?.raw_cv_json && typeof currentCp.raw_cv_json === "object" ? currentCp.raw_cv_json : {};
  const experienceRows = Array.isArray(extracted.experiences) ? extracted.experiences : [];
  const experienceSuggestions =
    mode === "existing_candidate"
      ? experienceRows.map((item, index) =>
          buildExperienceSuggestion({
            extracted: item,
            existingRows: Array.isArray(existingExperienceRes.data) ? existingExperienceRes.data : [],
            inviteId,
            index,
          })
        )
      : [];

  const cpPatch: Record<string, any> = {
    user_id: userId,
    updated_at: nowIso,
    source: currentCp?.source || "company_cv_import",
    raw_cv_json: {
      ...existingRawCvJson,
      company_cv_import: {
        invite_id: inviteId,
        extracted_payload: extracted,
        imported_at: nowIso,
        mode,
      },
      company_cv_import_updates:
        mode === "existing_candidate"
          ? [
              {
                invite_id: inviteId,
                company_name: resolveCompanyDisplayName(params.companyName || null, "") || null,
                imported_at: nowIso,
                mode,
                experience_suggestions: experienceSuggestions,
              },
              ...(((existingRawCvJson as any)?.company_cv_import_updates || []) as any[]).filter(
                (item: any) => String(item?.invite_id || "") !== inviteId
              ),
            ].slice(0, 20)
          : ((existingRawCvJson as any)?.company_cv_import_updates || []),
    },
  };
  if (!normalizeText(currentCp?.summary) && extracted.headline) cpPatch.summary = extracted.headline;
  if (currentCp) await supabase.from("candidate_profiles").update(cpPatch).eq("user_id", userId);
  else await supabase.from("candidate_profiles").insert(cpPatch);

  const existingExact = new Set((existingExperienceRes.data || []).map((row: any) => expExactSig(row)));
  const existingPossible = new Set((existingExperienceRes.data || []).map((row: any) => expPossibleSig(row)));
  const experienceInsert: any[] = [];
  if (mode === "new_candidate") {
    for (const item of experienceRows) {
      const row: any = {
        user_id: userId,
        role_title: item.role_title || "Experiencia",
        company_name: item.company_name || "Empresa",
        start_date: normalizeDateForDb(item.start_date),
        end_date: normalizeDateForDb(item.end_date),
        description: item.description || null,
        matched_verification_id: null,
        confidence: null,
      };
      const exact = expExactSig(row);
      const possible = expPossibleSig(row);
      if (existingExact.has(exact) || existingPossible.has(possible)) continue;
      existingExact.add(exact);
      existingPossible.add(possible);
      if (profileExpColumns.has("import_source")) row.import_source = "company_cv_import";
      if (profileExpColumns.has("import_invite_id")) row.import_invite_id = inviteId;
      if (profileExpColumns.has("imported_at")) row.imported_at = nowIso;
      if (profileExpColumns.has("metadata")) {
        row.metadata = {
          import_source: "company_cv_import",
          import_invite_id: inviteId,
          imported_at: nowIso,
        };
      }
      experienceInsert.push(row);
    }
  }
  if (experienceInsert.length > 0) await supabase.from("profile_experiences").insert(experienceInsert);

  const currentEducation = Array.isArray((cpRes.data as any)?.education) ? (cpRes.data as any).education : [];
  const eduExact = new Set(currentEducation.map((row: any) => eduExactSig(row)));
  const eduPossible = new Set(currentEducation.map((row: any) => `${normalizeRoleOrTitle(row?.title)}|${normalizeCompanyOrInstitution(row?.institution)}`));
  const educationAppend: any[] = [];
  if (mode === "new_candidate") {
    for (const item of Array.isArray(extracted.education) ? extracted.education : []) {
      const normalized = {
        title: toNullable(item.title || item.study_field),
        institution: toNullable(item.institution),
        start_date: normalizeDateText(item.start_date),
        end_date: normalizeDateText(item.end_date),
        description: toNullable(item.description),
        import_source: "company_cv_import",
        import_invite_id: inviteId,
        imported_at: nowIso,
      };
      if (!shouldImportEducationRow(normalized)) continue;
      const exact = eduExactSig(normalized);
      const possible = `${normalizeRoleOrTitle(normalized?.title)}|${normalizeCompanyOrInstitution(normalized?.institution)}`;
      if (eduExact.has(exact) || eduPossible.has(possible)) continue;
      eduExact.add(exact);
      eduPossible.add(possible);
      educationAppend.push(normalized);
    }
  }
  if (educationAppend.length > 0) {
    await supabase
      .from("candidate_profiles")
      .update({
        education: [...currentEducation, ...educationAppend],
        updated_at: nowIso,
      })
      .eq("user_id", userId);
  }

  await persistLanguagesFromExtract({
    supabase,
    userId,
    inviteId,
    languagesRaw: Array.isArray(extracted.languages) ? extracted.languages : [],
  });

  return {
    mode,
    suggestions_count: experienceSuggestions.length,
    suggestions_new: experienceSuggestions.filter((item) => item.kind === "new").length,
    suggestions_updates: experienceSuggestions.filter((item) => item.kind === "update").length,
    suggestions_duplicates: experienceSuggestions.filter((item) => item.kind === "duplicate").length,
    experiences_imported: experienceInsert.length,
    education_imported: educationAppend.length,
    languages_detected: Array.isArray(extracted.languages) ? extracted.languages.length : 0,
  };
}
