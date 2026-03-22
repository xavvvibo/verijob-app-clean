import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  normalizeCvLanguages,
  shouldImportEducationRow,
} from "@/lib/candidate/cv-parse-normalize";
import {
  readCandidateProfileCollections,
  replaceCandidateAchievementsCollection,
  replaceCandidateCertificationsCollection,
  replaceCandidateEducationCollection,
  replaceCandidateLanguagesCollection,
} from "@/lib/candidate/profile-collections";

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
  if (!db) return null;
  return db.slice(0, 7);
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
  while (parts.length > 0 && COMPANY_SUFFIXES.has(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join(" ");
}

function normalizeRoleOrTitle(v: any) {
  return collapseSpaces(normalizedBase(v).replace(/[.,;:()]+/g, " "));
}

function isLikelyAcademic(item: any) {
  const role = normalizeRoleOrTitle(item?.role_title || item?.title);
  const company = normalizeCompanyOrInstitution(item?.company_name || item?.company);
  const institution = normalizeCompanyOrInstitution(item?.institution);
  if (!company && institution) return true;
  const academicTokens = ["grado", "master", "licenciatura", "universidad", "fp", "doctorado", "curso"];
  return academicTokens.some((token) => role.includes(token)) && !company;
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
  const title = normalizeRoleOrTitle(row?.role_title || row?.title);
  const company = normalizeCompanyOrInstitution(row?.company_name || row?.company);
  const start = normalizeMonth(row?.start_date);
  const end = normalizeMonth(row?.end_date);
  return `${title}|${company}|${start}|${end}`;
}

function expPossibleSig(row: any) {
  const title = normalizeRoleOrTitle(row?.role_title || row?.title);
  const company = normalizeCompanyOrInstitution(row?.company_name || row?.company);
  return `${title}|${company}`;
}

function eduExactSig(row: any) {
  const title = normalizeRoleOrTitle(row?.title || row?.degree);
  const institution = normalizeCompanyOrInstitution(row?.institution);
  const start = normalizeMonth(row?.start_date || row?.start);
  const end = normalizeMonth(row?.end_date || row?.end);
  return `${title}|${institution}|${start}|${end}`;
}

function normalizeAchievementCategory(value: any) {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "idioma") return "idioma";
  if (raw === "certificacion" || raw === "certificación" || raw === "certificate" || raw === "certification") return "certificacion";
  if (raw === "premio" || raw === "award") return "premio";
  return "otro";
}

async function getTableColumns(supabase: any, table: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", table);
    if (error || !Array.isArray(data)) return new Set();
    return new Set(data.map((x: any) => String(x?.column_name || "").trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function persistLanguagesFromExtract(params: {
  supabase: any;
  userId: string;
  languagesRaw: any[];
}) {
  const { supabase, userId, languagesRaw } = params;
  const normalizedLanguages = normalizeCvLanguages(Array.isArray(languagesRaw) ? languagesRaw : [], 50);

  if (normalizedLanguages.length === 0) {
    return { imported: 0, duplicatesSkipped: 0 };
  }
  const collections = await readCandidateProfileCollections(supabase, userId);
  const existing = new Set(collections.languages.map((item) => normalizeText(item.language_name).toLowerCase()));
  const merged = [...collections.languages];
  let imported = 0;

  for (const languageName of normalizedLanguages) {
    const key = normalizeText(languageName).toLowerCase();
    if (!key || existing.has(key)) continue;
    existing.add(key);
    imported += 1;
    merged.push({
      language_name: languageName,
      proficiency_level: "",
      is_native: false,
      notes: "",
      source: "cv_parse",
      display_order: merged.length,
      is_visible: true,
    });
  }

  await replaceCandidateLanguagesCollection(supabase, userId, merged, "cv_parse");
  return { imported, duplicatesSkipped: Math.max(normalizedLanguages.length - imported, 0) };
}

async function persistAchievementsFromExtract(params: {
  supabase: any;
  userId: string;
  jobId: string;
  achievementsRaw: any[];
}) {
  const { supabase, userId, jobId, achievementsRaw } = params;
  const normalized = (Array.isArray(achievementsRaw) ? achievementsRaw : [])
    .map((item: any) => {
      const title = normalizeText(item?.title);
      const issuer = toNullable(item?.issuer);
      const date = toNullable(item?.date);
      const description = toNullable(item?.description);
      const category = normalizeAchievementCategory(item?.category);
      if (!title && !issuer && !date && !description) return null;
      return {
        title: title || issuer || description || "Logro detectado",
        issuer,
        date,
        description,
        category,
        import_source: "cv_parse",
        import_job_id: jobId,
        imported_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    return { imported: 0, duplicatesSkipped: 0 };
  }

  const collections = await readCandidateProfileCollections(supabase, userId);
  const existingCerts = new Set(
    collections.certifications.map((item) =>
      `${normalizeText(item.name).toLowerCase()}|${normalizeText(item.issuer).toLowerCase()}|${normalizeText(item.issue_date).toLowerCase()}`,
    ),
  );
  const existingAchievements = new Set(
    collections.achievements.map((item) =>
      `${normalizeText(item.title).toLowerCase()}|${normalizeText(item.issuer).toLowerCase()}|${normalizeText(item.achieved_at).toLowerCase()}`,
    ),
  );

  const mergedCertifications = [...collections.certifications];
  const mergedAchievements = [...collections.achievements];
  let imported = 0;

  for (const item of normalized) {
    if (item.category === "idioma") continue;
    if (item.category === "certificacion") {
      const key = `${normalizeText(item.title).toLowerCase()}|${normalizeText(item.issuer).toLowerCase()}|${normalizeText(item.date).toLowerCase()}`;
      if (!key || existingCerts.has(key)) continue;
      existingCerts.add(key);
      imported += 1;
      mergedCertifications.push({
        name: item.title,
        issuer: item.issuer || "",
        issue_date: item.date || "",
        expiry_date: "",
        credential_id: "",
        credential_url: "",
        notes: item.description || "",
        source: "cv_parse",
        display_order: mergedCertifications.length,
        is_visible: true,
      });
      continue;
    }

    const key = `${normalizeText(item.title).toLowerCase()}|${normalizeText(item.issuer).toLowerCase()}|${normalizeText(item.date).toLowerCase()}`;
    if (!key || existingAchievements.has(key)) continue;
    existingAchievements.add(key);
    imported += 1;
    mergedAchievements.push({
      title: item.title,
      description: item.description || "",
      achievement_type: item.category,
      issuer: item.issuer || "",
      achieved_at: item.date || "",
      source: "cv_parse",
      display_order: mergedAchievements.length,
      is_visible: true,
    });
  }

  await Promise.all([
    replaceCandidateCertificationsCollection(supabase, userId, mergedCertifications, "cv_parse"),
    replaceCandidateAchievementsCollection(supabase, userId, mergedAchievements, "cv_parse"),
  ]);
  return { imported, duplicatesSkipped: Math.max(normalized.length - imported, 0) };
}

async function importExperiencesSection(params: {
  supabase: any;
  userId: string;
  jobId: string;
  result: any;
  selectedItems: any[] | null;
  includeSupplemental: boolean;
}) {
  const { supabase, userId, jobId, result, selectedItems, includeSupplemental } = params;
  const extractedAll = Array.isArray(result?.experiences) ? result.experiences : [];
  const selectedRaw = selectedItems ?? extractedAll;
  const totalDetected = extractedAll.length;
  const selectedCount = selectedRaw.length;

  const candidateRows = selectedRaw
    .filter((x: any) => !isLikelyAcademic(x))
    .map((x: any) => {
      const role_title = toNullable(x?.role_title || x?.title);
      const company_name = toNullable(x?.company_name || x?.company);
      const description = toNullable(x?.description);
      const startDate = normalizeDateForDb(x?.start_date);
      if (!role_title || !company_name || !startDate) return null;
      const endDate = normalizeDateForDb(x?.end_date);
      return {
        user_id: userId,
        role_title,
        company_name,
        start_date: startDate,
        end_date: endDate,
        description,
        matched_verification_id: null,
        confidence: null,
      };
    })
    .filter(Boolean);

  if (candidateRows.length === 0) {
    return {
      section: "experiences" as const,
      imported: 0,
      duplicates_skipped: 0,
      not_selected: Math.max(totalDetected - selectedCount, 0),
      languages_imported: 0,
      languages_error: null,
      achievements_imported: 0,
      achievements_error: null,
    };
  }

  const [{ data: existingRows, error: existingErr }, profileExpColumns] = await Promise.all([
    supabase
      .from("profile_experiences")
      .select("role_title,company_name,start_date,end_date")
      .eq("user_id", userId),
    getTableColumns(supabase, "profile_experiences"),
  ]);

  if (existingErr) {
    throw new Error(`profile_experiences_existing_fetch_failed:${existingErr.message}`);
  }

  const existingExact = new Set((existingRows || []).map((x: any) => expExactSig(x)));
  const existingPossible = new Set((existingRows || []).map((x: any) => expPossibleSig(x)));
  const importedAtIso = new Date().toISOString();

  const toInsert: any[] = [];
  for (const row of candidateRows as any[]) {
    const exact = expExactSig(row);
    const possible = expPossibleSig(row);
    if (existingExact.has(exact) || existingPossible.has(possible)) continue;
    existingExact.add(exact);
    existingPossible.add(possible);

    const next: any = { ...row };
    if (profileExpColumns.has("import_source")) next.import_source = "cv_parse";
    if (profileExpColumns.has("import_job_id")) next.import_job_id = jobId;
    if (profileExpColumns.has("imported_at")) next.imported_at = importedAtIso;
    if (profileExpColumns.has("metadata")) {
      next.metadata = {
        import_source: "cv_parse",
        import_job_id: jobId,
        imported_at: importedAtIso,
      };
    }
    toInsert.push(next);
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("profile_experiences").insert(toInsert);
    if (insErr) {
      throw new Error(`profile_experiences_insert_failed:${insErr.message}`);
    }
  }

  let langImport: any = { imported: 0, error: null };
  let achievementsImport: any = { imported: 0, error: null };

  if (includeSupplemental) {
    [langImport, achievementsImport] = await Promise.all([
      persistLanguagesFromExtract({
        supabase,
        userId,
        languagesRaw: Array.isArray(result?.languages) ? result.languages : [],
      }).catch((e: any) => ({ imported: 0, duplicatesSkipped: 0, error: String(e?.message || e) })),
      persistAchievementsFromExtract({
        supabase,
        userId,
        jobId,
        achievementsRaw: Array.isArray(result?.achievements) ? result.achievements : [],
      }).catch((e: any) => ({ imported: 0, duplicatesSkipped: 0, error: String(e?.message || e) })),
    ]);
  }

  return {
    section: "experiences" as const,
    imported: toInsert.length,
    duplicates_skipped: Math.max(selectedCount - toInsert.length, 0),
    not_selected: Math.max(totalDetected - selectedCount, 0),
    languages_imported: Number(langImport?.imported || 0),
    languages_error: langImport?.error || null,
    achievements_imported: Number(achievementsImport?.imported || 0),
    achievements_error: achievementsImport?.error || null,
  };
}

async function importEducationSection(params: {
  supabase: any;
  userId: string;
  jobId: string;
  result: any;
  selectedItems: any[] | null;
  includeSupplemental: boolean;
}) {
  const { supabase, userId, jobId, result, selectedItems, includeSupplemental } = params;
  const extractedAll = Array.isArray(result?.education) ? result.education : [];
  const selectedRaw = selectedItems ?? extractedAll;
  const totalDetected = extractedAll.length;
  const selectedCount = selectedRaw.length;
  const importedAt = new Date().toISOString();

  const normalized = selectedRaw
    .map((x: any) => {
      const title = toNullable(x?.title || x?.degree);
      const institution = toNullable(x?.institution);
      const description = toNullable(x?.description || x?.notes);
      if (!shouldImportEducationRow({ title, institution, description })) return null;
      return {
        title: title || "",
        institution: institution || "",
        start_date: normalizeDateText(x?.start_date || x?.start),
        end_date: normalizeDateText(x?.end_date || x?.end),
        description,
        import_source: "cv_parse",
        import_job_id: jobId,
        imported_at: importedAt,
      };
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    return {
      section: "education" as const,
      imported: 0,
      duplicates_skipped: 0,
      not_selected: Math.max(totalDetected - selectedCount, 0),
      languages_imported: 0,
      languages_error: null,
      achievements_imported: 0,
      achievements_error: null,
    };
  }

  const collections = await readCandidateProfileCollections(supabase, userId);
  const currentEducation = Array.isArray(collections.education) ? collections.education : [];
  const mergedExact = new Set(currentEducation.map((x: any) => eduExactSig(x)));
  const mergedPossible = new Set(currentEducation.map((x: any) => `${normalizeRoleOrTitle(x?.title)}|${normalizeCompanyOrInstitution(x?.institution)}`));
  const toAppend: any[] = [];
  for (const row of normalized as any[]) {
    const exact = eduExactSig(row);
    const possible = `${normalizeRoleOrTitle(row?.title)}|${normalizeCompanyOrInstitution(row?.institution)}`;
    if (mergedExact.has(exact) || mergedPossible.has(possible)) continue;
    mergedExact.add(exact);
    mergedPossible.add(possible);
    toAppend.push(row);
  }

  if (toAppend.length > 0) {
    await replaceCandidateEducationCollection(supabase, userId, [...currentEducation, ...toAppend], "cv_parse");
  }

  let langImport: any = { imported: 0, error: null };
  let achievementsImport: any = { imported: 0, error: null };

  if (includeSupplemental) {
    [langImport, achievementsImport] = await Promise.all([
      persistLanguagesFromExtract({
        supabase,
        userId,
        languagesRaw: Array.isArray(result?.languages) ? result.languages : [],
      }).catch((e: any) => ({ imported: 0, duplicatesSkipped: 0, error: String(e?.message || e) })),
      persistAchievementsFromExtract({
        supabase,
        userId,
        jobId,
        achievementsRaw: Array.isArray(result?.achievements) ? result.achievements : [],
      }).catch((e: any) => ({ imported: 0, duplicatesSkipped: 0, error: String(e?.message || e) })),
    ]);
  }

  return {
    section: "education" as const,
    imported: toAppend.length,
    duplicates_skipped: Math.max(selectedCount - toAppend.length, 0),
    not_selected: Math.max(totalDetected - selectedCount, 0),
    languages_imported: Number(langImport?.imported || 0),
    languages_error: langImport?.error || null,
    achievements_imported: Number(achievementsImport?.imported || 0),
    achievements_error: achievementsImport?.error || null,
  };
}

async function importLanguagesSection(params: {
  supabase: any;
  userId: string;
  jobId: string;
  result: any;
  selectedItems: any[] | null;
  includeSupplemental: boolean;
}) {
  const { supabase, userId, jobId, result, selectedItems, includeSupplemental } = params;
  const extractedAll = Array.isArray(result?.languages) ? result.languages : [];
  const selectedRaw = selectedItems ?? extractedAll;
  const selectedCount = Array.isArray(selectedRaw) ? selectedRaw.length : 0;
  if (selectedCount === 0) {
    return {
      section: "languages" as const,
      imported: 0,
      duplicates_skipped: 0,
      not_selected: Math.max(extractedAll.length - selectedCount, 0),
      achievements_imported: 0,
      achievements_error: null,
    };
  }

  const langResult = await persistLanguagesFromExtract({
    supabase,
    userId,
    languagesRaw: selectedRaw,
  });

  let achievementsImport: any = { imported: 0, error: null };
  if (includeSupplemental) {
    achievementsImport = await persistAchievementsFromExtract({
      supabase,
      userId,
      jobId,
      achievementsRaw: Array.isArray(result?.achievements) ? result.achievements : [],
    }).catch((e: any) => ({ imported: 0, duplicatesSkipped: 0, error: String(e?.message || e) }));
  }

  return {
    section: "languages" as const,
    imported: langResult.imported,
    duplicates_skipped: langResult.duplicatesSkipped,
    not_selected: Math.max(extractedAll.length - selectedCount, 0),
    achievements_imported: Number(achievementsImport?.imported || 0),
    achievements_error: achievementsImport?.error || null,
  };
}

async function importAchievementsSection(params: {
  supabase: any;
  userId: string;
  jobId: string;
  result: any;
  selectedItems: any[] | null;
}) {
  const { supabase, userId, jobId, result, selectedItems } = params;
  const extractedAll = Array.isArray(result?.achievements) ? result.achievements : [];
  const selectedRaw = selectedItems ?? extractedAll;
  const selectedCount = Array.isArray(selectedRaw) ? selectedRaw.length : 0;
  if (selectedCount === 0) {
    return {
      section: "achievements" as const,
      imported: 0,
      duplicates_skipped: 0,
      not_selected: Math.max(extractedAll.length - selectedCount, 0),
    };
  }

  const achievementResult = await persistAchievementsFromExtract({
    supabase,
    userId,
    jobId,
    achievementsRaw: selectedRaw,
  });

  return {
    section: "achievements" as const,
    imported: achievementResult.imported,
    duplicates_skipped: achievementResult.duplicatesSkipped,
    not_selected: Math.max(extractedAll.length - selectedCount, 0),
  };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const jobId = typeof body?.job_id === "string" ? body.job_id.trim() : "";
  const section = typeof body?.section === "string" ? body.section.trim() : "";
  const selectedItems = Array.isArray(body?.selected_items) ? body.selected_items : null;

  if (!jobId || !section) {
    return NextResponse.json({ error: "missing_job_id_or_section" }, { status: 400 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("cv_parse_jobs")
    .select("id,user_id,status,result_json")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (jobErr) return NextResponse.json({ error: "job_fetch_failed", details: jobErr.message }, { status: 400 });
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  if (job.status !== "succeeded") return NextResponse.json({ error: "job_not_succeeded" }, { status: 400 });

  const result = (job as any)?.result_json || {};

  if (section === "all") {
    const selections = typeof body?.selected_items === "object" && body?.selected_items !== null ? body.selected_items : {};
    const blockRunner = async (run: () => Promise<any>) => {
      try {
        const result = await run();
        return { ...result, error: null };
      } catch (error: any) {
        return {
          imported: 0,
          duplicates_skipped: 0,
          not_selected: 0,
          error: String(error?.message || error || "unknown_error"),
        };
      }
    };

    const experiences = await blockRunner(() =>
      importExperiencesSection({
        supabase,
        userId: user.id,
        jobId,
        result,
        selectedItems: Array.isArray(selections?.experiences) ? selections.experiences : [],
        includeSupplemental: false,
      }),
    );
    const education = await blockRunner(() =>
      importEducationSection({
        supabase,
        userId: user.id,
        jobId,
        result,
        selectedItems: Array.isArray(selections?.education) ? selections.education : [],
        includeSupplemental: false,
      }),
    );
    const languages = await blockRunner(() =>
      importLanguagesSection({
        supabase,
        userId: user.id,
        jobId,
        result,
        selectedItems: Array.isArray(selections?.languages) ? selections.languages : [],
        includeSupplemental: false,
      }),
    );
    const achievements = await blockRunner(() =>
      importAchievementsSection({
        supabase,
        userId: user.id,
        jobId,
        result,
        selectedItems: Array.isArray(selections?.achievements) ? selections.achievements : [],
      }),
    );

    return NextResponse.json({
      ok: true,
      section: "all",
      imported_total:
        Number(experiences.imported || 0) +
        Number(education.imported || 0) +
        Number(languages.imported || 0) +
        Number(achievements.imported || 0),
      blocks: {
        experiences,
        education,
        languages,
        achievements,
      },
    });
  }

  if (section === "experiences") {
    try {
      return NextResponse.json(
        await importExperiencesSection({
          supabase,
          userId: user.id,
          jobId,
          result,
          selectedItems,
          includeSupplemental: true,
        }),
      );
    } catch (error: any) {
      const message = String(error?.message || error || "unknown_error");
      const [code, ...rest] = message.split(":");
      return NextResponse.json({ error: code || "profile_experiences_import_failed", details: rest.join(":") || message }, { status: 400 });
    }
  }

  if (section === "education") {
    try {
      return NextResponse.json(
        await importEducationSection({
          supabase,
          userId: user.id,
          jobId,
          result,
          selectedItems,
          includeSupplemental: true,
        }),
      );
    } catch (error: any) {
      const message = String(error?.message || error || "unknown_error");
      const [code, ...rest] = message.split(":");
      return NextResponse.json({ error: code || "education_persist_failed", details: rest.join(":") || message }, { status: 400 });
    }
  }

  if (section === "languages") {
    try {
      return NextResponse.json(
        await importLanguagesSection({
          supabase,
          userId: user.id,
          jobId,
          result,
          selectedItems,
          includeSupplemental: true,
        }),
      );
    } catch (error: any) {
      return NextResponse.json({ error: "languages_import_failed", details: String(error?.message || error || "unknown_error") }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "unsupported_section" }, { status: 400 });
}
