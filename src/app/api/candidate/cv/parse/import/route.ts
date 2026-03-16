import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  normalizeCvLanguages,
  selectLanguagesPersistenceTarget,
  shouldImportEducationRow,
} from "@/lib/candidate/cv-parse-normalize";

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

function isLikelyWorkItem(item: any) {
  const role = normalizeRoleOrTitle(item?.role_title || item?.title);
  const company = normalizeCompanyOrInstitution(item?.company_name || item?.company);
  const institution = normalizeCompanyOrInstitution(item?.institution);
  if (company) return true;
  if (institution && !company) return false;
  return Boolean(role);
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
  jobId: string;
  languagesRaw: any[];
}) {
  const { supabase, userId, jobId, languagesRaw } = params;
  const normalizedLanguages = normalizeCvLanguages(Array.isArray(languagesRaw) ? languagesRaw : [], 50);

  if (normalizedLanguages.length === 0) {
    return { imported: 0, duplicatesSkipped: 0 };
  }

  const [profileColumns, candidateProfileColumns, cpRes] = await Promise.all([
    getTableColumns(supabase, "profiles"),
    getTableColumns(supabase, "candidate_profiles"),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const persistenceTarget = selectLanguagesPersistenceTarget(profileColumns, candidateProfileColumns);
  if (persistenceTarget === "profiles.languages") {
    const { data: profileRow } = await supabase.from("profiles").select("languages").eq("id", userId).maybeSingle();
    const current = Array.isArray((profileRow as any)?.languages)
      ? (profileRow as any).languages.map((x: any) => normalizeText(x)).filter(Boolean)
      : [];
    const currentSet = new Set(current.map((x: string) => x.toLowerCase()));
    const toAppend = normalizedLanguages.filter((lang: string) => !currentSet.has(lang.toLowerCase()));

    if (toAppend.length > 0) {
      const merged = [...current, ...toAppend];
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ languages: merged, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (upErr) throw new Error(`languages_profile_update_failed:${upErr.message}`);
    }
    return { imported: toAppend.length, duplicatesSkipped: normalizedLanguages.length - toAppend.length };
  }

  if (persistenceTarget === "skip") {
    return {
      imported: 0,
      duplicatesSkipped: normalizedLanguages.length,
      error: "languages_persistence_unavailable",
    };
  }

  const targetColumn = persistenceTarget === "candidate_profiles.other_achievements" ? "other_achievements" : "achievements";
  const currentAchievements = Array.isArray((cpRes.data as any)?.[targetColumn]) ? (cpRes.data as any)[targetColumn] : [];
  const currentLangSet = new Set(
    currentAchievements
      .filter((x: any) => String(x?.category || "").toLowerCase() === "idioma")
      .map((x: any) => normalizeText(x?.language || x?.title).toLowerCase())
      .filter(Boolean)
  );
  const toAppend = normalizedLanguages.filter((lang: string) => !currentLangSet.has(lang.toLowerCase()));

  if (toAppend.length > 0) {
    const nowIso = new Date().toISOString();
    const merged = [
      ...currentAchievements,
      ...toAppend.map((lang: string) => ({
        title: lang,
        language: lang,
        category: "idioma",
        issuer: null,
        date: null,
        description: null,
        import_source: "cv_parse",
        import_job_id: jobId,
        imported_at: nowIso,
      })),
    ];
    const payload = {
      user_id: userId,
      [targetColumn]: merged,
      updated_at: nowIso,
    };
    const { error: persistErr } = cpRes.data
      ? await supabase.from("candidate_profiles").update(payload).eq("user_id", userId)
      : await supabase.from("candidate_profiles").insert(payload);
    if (persistErr) throw new Error(`languages_candidate_profile_persist_failed:${persistErr.message}`);
  }
  return { imported: toAppend.length, duplicatesSkipped: normalizedLanguages.length - toAppend.length };
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

  if (section === "experiences") {
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
          user_id: user.id,
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
      return NextResponse.json({
        ok: true,
        section: "experiences",
        imported: 0,
        duplicates_skipped: 0,
        not_selected: Math.max(totalDetected - selectedCount, 0),
      });
    }

    const [{ data: existingRows, error: existingErr }, profileExpColumns] = await Promise.all([
      supabase
        .from("profile_experiences")
        .select("role_title,company_name,start_date,end_date")
        .eq("user_id", user.id),
      getTableColumns(supabase, "profile_experiences"),
    ]);

    if (existingErr) {
      return NextResponse.json({ error: "profile_experiences_existing_fetch_failed", details: existingErr.message }, { status: 400 });
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
        return NextResponse.json({ error: "profile_experiences_insert_failed", details: insErr.message }, { status: 400 });
      }
    }

    const langImport = await persistLanguagesFromExtract({
      supabase,
      userId: user.id,
      jobId,
      languagesRaw: Array.isArray(result?.languages) ? result.languages : [],
    }).catch((e: any) => ({ imported: 0, duplicatesSkipped: 0, error: String(e?.message || e) }));

    return NextResponse.json({
      ok: true,
      section: "experiences",
      imported: toInsert.length,
      duplicates_skipped: Math.max(selectedCount - toInsert.length, 0),
      not_selected: Math.max(totalDetected - selectedCount, 0),
      languages_imported: Number((langImport as any)?.imported || 0),
      languages_error: (langImport as any)?.error || null,
    });
  }

  if (section === "education") {
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
      return NextResponse.json({
        ok: true,
        section: "education",
        imported: 0,
        duplicates_skipped: 0,
        not_selected: Math.max(totalDetected - selectedCount, 0),
      });
    }

    const { data: cp, error: cpErr } = await supabase
      .from("candidate_profiles")
      .select("education")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cpErr) return NextResponse.json({ error: "profile_fetch_failed", details: cpErr.message }, { status: 400 });

    const currentEducation = Array.isArray((cp as any)?.education) ? (cp as any).education : [];
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
      const merged = [...currentEducation, ...toAppend];
      const payload = {
        user_id: user.id,
        education: merged,
        updated_at: new Date().toISOString(),
      };

      let persistError: any = null;
      if (cp) {
        const { error } = await supabase.from("candidate_profiles").update(payload).eq("user_id", user.id);
        persistError = error;
      } else {
        const { error } = await supabase.from("candidate_profiles").insert(payload);
        persistError = error;
      }

      if (persistError) {
        return NextResponse.json({ error: "education_persist_failed", details: persistError.message }, { status: 400 });
      }
    }

    const langImport = await persistLanguagesFromExtract({
      supabase,
      userId: user.id,
      jobId,
      languagesRaw: Array.isArray(result?.languages) ? result.languages : [],
    }).catch((e: any) => ({ imported: 0, duplicatesSkipped: 0, error: String(e?.message || e) }));

    return NextResponse.json({
      ok: true,
      section: "education",
      imported: toAppend.length,
      duplicates_skipped: Math.max(selectedCount - toAppend.length, 0),
      not_selected: Math.max(totalDetected - selectedCount, 0),
      languages_imported: Number((langImport as any)?.imported || 0),
      languages_error: (langImport as any)?.error || null,
    });
  }

  if (section === "languages") {
    const extractedAll = Array.isArray(result?.languages) ? result.languages : [];
    const selectedRaw = selectedItems ?? extractedAll;
    if ((Array.isArray(selectedRaw) ? selectedRaw : []).length === 0) {
      return NextResponse.json({
        ok: true,
        section: "languages",
        imported: 0,
        duplicates_skipped: 0,
        not_selected: Math.max(extractedAll.length - selectedRaw.length, 0),
      });
    }

    const langResult = await persistLanguagesFromExtract({
      supabase,
      userId: user.id,
      jobId,
      languagesRaw: selectedRaw,
    });

    return NextResponse.json({
      ok: true,
      section: "languages",
      imported: langResult.imported,
      duplicates_skipped: langResult.duplicatesSkipped,
      not_selected: Math.max(extractedAll.length - selectedRaw.length, 0),
    });
  }

  return NextResponse.json({ error: "unsupported_section" }, { status: 400 });
}
