import { createHash } from "crypto";
import { extractCvTextFromBuffer } from "@/utils/cv/extractText";
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
  const companyName = String(params.companyName || "la empresa").trim();
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
}) {
  const { supabase, userId, inviteId, extracted, candidateEmail } = params;
  const nowIso = new Date().toISOString();

  const [profileColumns, existingProfileRes, cpRes, existingExperienceRes, profileExpColumns] = await Promise.all([
    getTableColumns(supabase, "profiles"),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_experiences").select("role_title,company_name,start_date,end_date").eq("user_id", userId),
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
  const cpPatch: Record<string, any> = {
    user_id: userId,
    updated_at: nowIso,
    source: currentCp?.source || "company_cv_import",
    raw_cv_json: {
      ...(currentCp?.raw_cv_json || {}),
      company_cv_import: {
        invite_id: inviteId,
        extracted_payload: extracted,
        imported_at: nowIso,
      },
    },
  };
  if (!normalizeText(currentCp?.summary) && extracted.headline) cpPatch.summary = extracted.headline;
  if (currentCp) await supabase.from("candidate_profiles").update(cpPatch).eq("user_id", userId);
  else await supabase.from("candidate_profiles").insert(cpPatch);

  const existingExact = new Set((existingExperienceRes.data || []).map((row: any) => expExactSig(row)));
  const existingPossible = new Set((existingExperienceRes.data || []).map((row: any) => expPossibleSig(row)));
  const experienceRows = Array.isArray(extracted.experiences) ? extracted.experiences : [];
  const experienceInsert: any[] = [];
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
  if (experienceInsert.length > 0) await supabase.from("profile_experiences").insert(experienceInsert);

  const currentEducation = Array.isArray((cpRes.data as any)?.education) ? (cpRes.data as any).education : [];
  const eduExact = new Set(currentEducation.map((row: any) => eduExactSig(row)));
  const eduPossible = new Set(currentEducation.map((row: any) => `${normalizeRoleOrTitle(row?.title)}|${normalizeCompanyOrInstitution(row?.institution)}`));
  const educationAppend: any[] = [];
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
    experiences_imported: experienceInsert.length,
    education_imported: educationAppend.length,
    languages_detected: Array.isArray(extracted.languages) ? extracted.languages.length : 0,
  };
}
