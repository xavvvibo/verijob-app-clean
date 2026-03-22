type SupabaseLike = {
  from: (table: string) => any;
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeNullableText(value: unknown) {
  const text = normalizeText(value);
  return text || null;
}

function toDateValue(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ym = text.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const y = text.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return null;
}

function toMonthText(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const ym = text.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}`;
  const y = text.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01`;
  return text;
}

export type CandidateEducationUiItem = {
  id: string;
  title: string;
  institution: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  description: string;
  in_progress: boolean;
  source: string;
  display_order: number;
  is_visible: boolean;
};

export type CandidateLanguageUiItem = {
  id: string;
  language_name: string;
  proficiency_level: string;
  is_native: boolean;
  notes: string;
  source: string;
  display_order: number;
  is_visible: boolean;
};

export type CandidateCertificationUiItem = {
  id: string;
  name: string;
  issuer: string;
  issue_date: string;
  expiry_date: string;
  credential_id: string;
  credential_url: string;
  notes: string;
  source: string;
  display_order: number;
  is_visible: boolean;
};

export type CandidateAchievementUiItem = {
  id: string;
  title: string;
  description: string;
  achievement_type: string;
  issuer: string;
  achieved_at: string;
  source: string;
  display_order: number;
  is_visible: boolean;
};

type AchievementCatalogItem = {
  title: string;
  language: string | null;
  level: string | null;
  certificate_title: string | null;
  issuer: string | null;
  date: string | null;
  description: string | null;
  category: "idioma" | "certificacion" | "premio" | "otro";
};

export async function getPublicTableColumns(admin: SupabaseLike, tableName: string) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);
  if (error || !Array.isArray(data)) return new Set<string>();
  return new Set(data.map((row: any) => String(row?.column_name || "")));
}

export async function publicTableExists(admin: SupabaseLike, tableName: string) {
  const columns = await getPublicTableColumns(admin, tableName);
  return columns.size > 0;
}

function resolveOwnerColumns(columns: Set<string>) {
  return {
    userId: columns.has("user_id"),
    candidateId: columns.has("candidate_id"),
    filterColumn: columns.has("user_id") ? "user_id" : columns.has("candidate_id") ? "candidate_id" : null,
  };
}

async function ensureCandidateProfileId(admin: SupabaseLike, userId: string) {
  const candidateProfilesExists = await publicTableExists(admin, "candidate_profiles");
  if (!candidateProfilesExists) return null;

  const current = await admin.from("candidate_profiles").select("id").eq("user_id", userId).maybeSingle();
  if (!current.error && current.data?.id) return String(current.data.id);

  const inserted = await admin
    .from("candidate_profiles")
    .insert({ user_id: userId })
    .select("id")
    .maybeSingle();

  if (!inserted.error && inserted.data?.id) return String(inserted.data.id);
  return null;
}

function mapEducationRow(row: any): CandidateEducationUiItem {
  return {
    id: String(row?.id || ""),
    title: normalizeText(row?.degree_name),
    institution: normalizeText(row?.institution_name),
    field_of_study: normalizeText(row?.field_of_study),
    start_date: toMonthText(row?.start_date),
    end_date: toMonthText(row?.end_date),
    description: normalizeText(row?.description),
    in_progress: Boolean(row?.is_current),
    source: normalizeText(row?.source) || "manual",
    display_order: Number(row?.display_order || 0),
    is_visible: row?.is_visible !== false,
  };
}

function mapLanguageRow(row: any): CandidateLanguageUiItem {
  return {
    id: String(row?.id || ""),
    language_name: normalizeText(row?.language_name),
    proficiency_level: normalizeText(row?.proficiency_level),
    is_native: Boolean(row?.is_native),
    notes: normalizeText(row?.notes),
    source: normalizeText(row?.source) || "manual",
    display_order: Number(row?.display_order || 0),
    is_visible: row?.is_visible !== false,
  };
}

function mapCertificationRow(row: any): CandidateCertificationUiItem {
  return {
    id: String(row?.id || ""),
    name: normalizeText(row?.name),
    issuer: normalizeText(row?.issuer),
    issue_date: toMonthText(row?.issue_date),
    expiry_date: toMonthText(row?.expiry_date),
    credential_id: normalizeText(row?.credential_id),
    credential_url: normalizeText(row?.credential_url),
    notes: normalizeText(row?.notes),
    source: normalizeText(row?.source) || "manual",
    display_order: Number(row?.display_order || 0),
    is_visible: row?.is_visible !== false,
  };
}

function mapAchievementRow(row: any): CandidateAchievementUiItem {
  return {
    id: String(row?.id || ""),
    title: normalizeText(row?.title),
    description: normalizeText(row?.description),
    achievement_type: normalizeText(row?.achievement_type),
    issuer: normalizeText(row?.issuer),
    achieved_at: toMonthText(row?.achieved_at),
    source: normalizeText(row?.source) || "manual",
    display_order: Number(row?.display_order || 0),
    is_visible: row?.is_visible !== false,
  };
}

function dedupeCatalog(items: AchievementCatalogItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [
      item.category,
      normalizeText(item.title).toLowerCase(),
      normalizeText(item.language).toLowerCase(),
      normalizeText(item.level).toLowerCase(),
      normalizeText(item.issuer).toLowerCase(),
      normalizeText(item.date).toLowerCase(),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildAchievementsCatalog(params: {
  languages: CandidateLanguageUiItem[];
  certifications: CandidateCertificationUiItem[];
  achievements: CandidateAchievementUiItem[];
}) {
  const languageItems: AchievementCatalogItem[] = params.languages.map((item) => ({
    title: item.language_name,
    language: item.language_name || null,
    level: item.proficiency_level || null,
    certificate_title: null,
    issuer: null,
    date: null,
    description: item.notes || null,
    category: "idioma",
  }));
  const certificationItems: AchievementCatalogItem[] = params.certifications.map((item) => ({
    title: item.name,
    language: null,
    level: null,
    certificate_title: item.credential_id || item.credential_url || null,
    issuer: item.issuer || null,
    date: item.issue_date || null,
    description: item.notes || null,
    category: "certificacion",
  }));
  const achievementItems: AchievementCatalogItem[] = params.achievements.map((item) => ({
    title: item.title,
    language: null,
    level: null,
    certificate_title: null,
    issuer: item.issuer || null,
    date: item.achieved_at || null,
    description: item.description || null,
    category: normalizeText(item.achievement_type).toLowerCase() === "premio" ? "premio" : "otro",
  }));
  const all = dedupeCatalog([...languageItems, ...certificationItems, ...achievementItems]);
  return {
    all,
    languages: all.filter((item) => item.category === "idioma"),
    certifications: all.filter((item) => item.category === "certificacion"),
    awards: all.filter((item) => item.category === "premio"),
    others: all.filter((item) => item.category === "otro"),
  };
}

export async function readCandidateProfileCollections(
  admin: SupabaseLike,
  userId: string,
  options?: { candidateProfile?: any }
) {
  const [educationColumns, languagesColumns, certificationsColumns, achievementsColumns] = await Promise.all([
    getPublicTableColumns(admin, "candidate_education"),
    getPublicTableColumns(admin, "candidate_languages"),
    getPublicTableColumns(admin, "candidate_certifications"),
    getPublicTableColumns(admin, "candidate_achievements"),
  ]);
  const educationExists = educationColumns.size > 0;
  const languagesExists = languagesColumns.size > 0;
  const certificationsExists = certificationsColumns.size > 0;
  const achievementsExists = achievementsColumns.size > 0;
  const educationOwner = resolveOwnerColumns(educationColumns);
  const languagesOwner = resolveOwnerColumns(languagesColumns);
  const certificationsOwner = resolveOwnerColumns(certificationsColumns);
  const achievementsOwner = resolveOwnerColumns(achievementsColumns);

  const [educationRes, languagesRes, certificationsRes, achievementsRes] = await Promise.all([
    educationExists && educationOwner.filterColumn
      ? admin
          .from("candidate_education")
          .select("*")
          .eq(educationOwner.filterColumn, userId)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    languagesExists && languagesOwner.filterColumn
      ? admin
          .from("candidate_languages")
          .select("*")
          .eq(languagesOwner.filterColumn, userId)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    certificationsExists && certificationsOwner.filterColumn
      ? admin
          .from("candidate_certifications")
          .select("*")
          .eq(certificationsOwner.filterColumn, userId)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    achievementsExists && achievementsOwner.filterColumn
      ? admin
          .from("candidate_achievements")
          .select("*")
          .eq(achievementsOwner.filterColumn, userId)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const candidateProfile = options?.candidateProfile || null;
  const legacyEducation = Array.isArray(candidateProfile?.education)
    ? candidateProfile.education.map((item: any, index: number) => ({
        id: String(item?.id || `legacy-education-${index}`),
        title: normalizeText(item?.title || item?.degree),
        institution: normalizeText(item?.institution),
        field_of_study: "",
        start_date: toMonthText(item?.start_date || item?.start),
        end_date: toMonthText(item?.end_date || item?.end),
        description: normalizeText(item?.description || item?.notes),
        in_progress: Boolean(item?.in_progress),
        source: "legacy",
        display_order: index,
        is_visible: true,
      }))
    : [];
  const legacyCertifications = Array.isArray(candidateProfile?.certifications)
    ? candidateProfile.certifications.map((item: any, index: number) => ({
        id: String(item?.id || `legacy-certification-${index}`),
        name: normalizeText(item?.title || item?.name),
        issuer: normalizeText(item?.issuer),
        issue_date: toMonthText(item?.date || item?.issue_date),
        expiry_date: "",
        credential_id: normalizeText(item?.certificate_title),
        credential_url: "",
        notes: normalizeText(item?.description),
        source: "legacy",
        display_order: index,
        is_visible: true,
      }))
    : [];

  const education = (Array.isArray(educationRes.data) && educationRes.data.length ? educationRes.data.map(mapEducationRow) : legacyEducation).filter(Boolean);
  const languages = (Array.isArray(languagesRes.data) ? languagesRes.data.map(mapLanguageRow) : []).filter(Boolean);
  const certifications = (
    Array.isArray(certificationsRes.data) && certificationsRes.data.length
      ? certificationsRes.data.map(mapCertificationRow)
      : legacyCertifications
  ).filter(Boolean);
  const achievements = (Array.isArray(achievementsRes.data) ? achievementsRes.data.map(mapAchievementRow) : []).filter(Boolean);
  const catalog = buildAchievementsCatalog({ languages, certifications, achievements });

  return {
    support: {
      education: educationExists,
      languages: languagesExists,
      certifications: certificationsExists,
      achievements: achievementsExists,
    },
    education,
    languages,
    certifications,
    achievements,
    language_labels: languages.map((item) => {
      const name = normalizeText(item.language_name);
      const level = normalizeText(item.proficiency_level);
      return level ? `${name} — ${level}` : name;
    }).filter(Boolean),
    achievements_catalog: catalog,
  };
}

export function normalizeEducationItems(items: any[], source = "manual") {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      institution_name: normalizeText(item?.institution || item?.institution_name),
      degree_name: normalizeText(item?.title || item?.degree_name || item?.degree),
      field_of_study: normalizeNullableText(item?.field_of_study),
      start_date: toDateValue(item?.start_date),
      end_date: item?.in_progress || item?.is_current ? null : toDateValue(item?.end_date),
      is_current: Boolean(item?.in_progress || item?.is_current),
      description: normalizeNullableText(item?.description),
      source: normalizeText(item?.source) || source,
      display_order: Number(item?.display_order ?? index),
      is_visible: item?.is_visible !== false,
    }))
    .filter((item) => item.institution_name || item.degree_name || item.description);
}

export function normalizeLanguageItems(items: any[], source = "manual") {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      language_name: normalizeText(item?.language_name || item?.language || item?.title),
      proficiency_level: normalizeNullableText(item?.proficiency_level || item?.level),
      is_native: Boolean(item?.is_native),
      notes: normalizeNullableText(item?.notes || item?.description),
      source: normalizeText(item?.source) || source,
      display_order: Number(item?.display_order ?? index),
      is_visible: item?.is_visible !== false,
    }))
    .filter((item) => item.language_name);
}

export function normalizeCertificationItems(items: any[], source = "manual") {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      name: normalizeText(item?.name || item?.title),
      issuer: normalizeNullableText(item?.issuer),
      issue_date: toDateValue(item?.issue_date || item?.date),
      expiry_date: toDateValue(item?.expiry_date),
      credential_id: normalizeNullableText(item?.credential_id || item?.certificate_title),
      credential_url: normalizeNullableText(item?.credential_url),
      notes: normalizeNullableText(item?.notes || item?.description),
      source: normalizeText(item?.source) || source,
      display_order: Number(item?.display_order ?? index),
      is_visible: item?.is_visible !== false,
    }))
    .filter((item) => item.name);
}

export function normalizeAchievementItems(items: any[], source = "manual") {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      title: normalizeText(item?.title),
      description: normalizeNullableText(item?.description),
      achievement_type: normalizeNullableText(item?.achievement_type || item?.category),
      issuer: normalizeNullableText(item?.issuer),
      achieved_at: toDateValue(item?.achieved_at || item?.date),
      source: normalizeText(item?.source) || source,
      display_order: Number(item?.display_order ?? index),
      is_visible: item?.is_visible !== false,
    }))
    .filter((item) => item.title || item.description || item.issuer);
}

async function replaceCollection(args: {
  admin: SupabaseLike;
  table: string;
  userId: string;
  items: Record<string, any>[];
}) {
  const tableColumns = await getPublicTableColumns(args.admin, args.table);
  if (!tableColumns.size) {
    throw new Error(`${args.table}_missing`);
  }
  const owner = resolveOwnerColumns(tableColumns);
  if (!owner.filterColumn) throw new Error(`${args.table}_owner_missing`);

  const candidateProfileId = await ensureCandidateProfileId(args.admin, args.userId);
  const deleteRes = await args.admin.from(args.table).delete().eq(owner.filterColumn, args.userId);
  if (deleteRes.error) throw deleteRes.error;

  if (!args.items.length) return;

  const rows = args.items.map((item) => {
    const row: Record<string, any> = { ...item };
    if (owner.userId) row.user_id = args.userId;
    if (owner.candidateId) row.candidate_id = args.userId;
    if (tableColumns.has("candidate_profile_id")) row.candidate_profile_id = candidateProfileId;
    return row;
  });
  const insertRes = await args.admin.from(args.table).insert(rows);
  if (insertRes.error) throw insertRes.error;
}

export async function replaceCandidateEducationCollection(admin: SupabaseLike, userId: string, items: any[], source = "manual") {
  return replaceCollection({
    admin,
    table: "candidate_education",
    userId,
    items: normalizeEducationItems(items, source),
  });
}

export async function replaceCandidateLanguagesCollection(admin: SupabaseLike, userId: string, items: any[], source = "manual") {
  return replaceCollection({
    admin,
    table: "candidate_languages",
    userId,
    items: normalizeLanguageItems(items, source),
  });
}

export async function replaceCandidateCertificationsCollection(admin: SupabaseLike, userId: string, items: any[], source = "manual") {
  return replaceCollection({
    admin,
    table: "candidate_certifications",
    userId,
    items: normalizeCertificationItems(items, source),
  });
}

export async function replaceCandidateAchievementsCollection(admin: SupabaseLike, userId: string, items: any[], source = "manual") {
  return replaceCollection({
    admin,
    table: "candidate_achievements",
    userId,
    items: normalizeAchievementItems(items, source),
  });
}

export async function clearCandidateProfileCollections(admin: SupabaseLike, userId: string) {
  for (const table of [
    "candidate_education",
    "candidate_languages",
    "candidate_certifications",
    "candidate_achievements",
  ]) {
    const columns = await getPublicTableColumns(admin, table);
    if (!columns.size) continue;
    const owner = resolveOwnerColumns(columns);
    if (!owner.filterColumn) continue;
    const { error } = await admin.from(table).delete().eq(owner.filterColumn, userId);
    if (error) throw error;
  }
}

export async function deleteCandidateCollectionItems(admin: SupabaseLike, table: string, userId: string, ids?: string[]) {
  const columns = await getPublicTableColumns(admin, table);
  if (!columns.size) throw new Error(`${table}_missing`);
  const owner = resolveOwnerColumns(columns);
  if (!owner.filterColumn) throw new Error(`${table}_owner_missing`);
  const query = admin.from(table).delete().eq(owner.filterColumn, userId);
  const result = ids && ids.length ? await query.in("id", ids) : await query;
  if (result.error) throw result.error;
}
