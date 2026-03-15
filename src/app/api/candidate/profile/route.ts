import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

type AchievementCategory = "certificacion" | "premio" | "idioma" | "otro";

type AchievementItem = {
  title: string;
  language: string | null;
  level: string | null;
  certificate_title: string | null;
  issuer: string | null;
  date: string | null;
  description: string | null;
  category: AchievementCategory;
};

function formatLanguageLabel(item: Partial<AchievementItem>) {
  const language = normalizeText(item.language || item.title);
  const level = normalizeText(item.level);
  if (!language) return null;
  return level ? `${language} — ${level}` : language;
}

function normalizeAchievement(raw: any): AchievementItem | null {
  const title = normalizeText(raw?.title);
  const language = normalizeText(raw?.language) || null;
  const level = normalizeText(raw?.level) || null;
  const certificateTitle = normalizeText(raw?.certificate_title) || null;
  const issuer = normalizeText(raw?.issuer) || null;
  const date = normalizeText(raw?.date) || null;
  const description = normalizeText(raw?.description) || null;
  const rawCategory = normalizeText(raw?.category).toLowerCase();
  const category: AchievementCategory =
    rawCategory === "idioma" || rawCategory === "premio" || rawCategory === "certificacion"
      ? (rawCategory as AchievementCategory)
      : "otro";
  const normalizedTitle = category === "idioma" ? title || language || "" : title;
  if (!normalizedTitle && !language && !issuer && !date && !description && !certificateTitle) return null;
  return {
    title: normalizedTitle,
    language,
    level,
    certificate_title: certificateTitle,
    issuer,
    date,
    description,
    category,
  };
}

function dedupeAchievements(items: AchievementItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const primary = item.category === "idioma" ? normalizeText(item.language || item.title) : normalizeText(item.title);
    const key = `${item.category}|${primary.toLowerCase()}|${normalizeText(item.level).toLowerCase()}|${normalizeText(item.issuer).toLowerCase()}|${normalizeText(item.date).toLowerCase()}`;
    if (!primary && !item.issuer && !item.date && !item.description) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildAchievementsCatalog(profile: any, candidateProfile: any) {
  const achievements = Array.isArray(candidateProfile?.achievements)
    ? candidateProfile.achievements.map(normalizeAchievement).filter(Boolean)
    : [];
  const certificationsLegacy = Array.isArray(candidateProfile?.certifications)
    ? candidateProfile.certifications.map(normalizeAchievement).filter(Boolean)
    : [];
  const profileLanguages = Array.isArray(profile?.languages)
    ? profile.languages
      .map((item: any) => normalizeText(item))
      .filter(Boolean)
      .map((title: string) => ({
        title,
        language: title,
        level: null,
        certificate_title: null,
        issuer: null,
        date: null,
        description: null,
        category: "idioma" as AchievementCategory,
      }))
    : [];

  const merged = dedupeAchievements([...profileLanguages, ...achievements, ...certificationsLegacy] as AchievementItem[]);
  return {
    all: merged,
    languages: merged.filter((item) => item.category === "idioma"),
    certifications: merged.filter((item) => item.category === "certificacion"),
    awards: merged.filter((item) => item.category === "premio"),
    others: merged.filter((item) => item.category === "otro"),
  };
}

async function readProfileAndCandidateProfile(supabase: any, userId: string) {
  const [profileRes, candidateProfileRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileRes.error) {
    return { error: NextResponse.json({ error: profileRes.error.message }, { status: 400 }) };
  }
  if (candidateProfileRes.error) {
    return { error: NextResponse.json({ error: candidateProfileRes.error.message }, { status: 400 }) };
  }

  return {
    profile: profileRes.data || null,
    candidateProfile: candidateProfileRes.data || null,
  };
}

async function getTableColumns(supabase: any, tableName: string) {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);
  if (error || !Array.isArray(data)) return new Set<string>();
  return new Set(data.map((row: any) => String(row?.column_name || "")));
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const read = await readProfileAndCandidateProfile(supabase, user.id);
  if ((read as any).error) return (read as any).error;
  const { profile, candidateProfile } = read as any;
  const achievementsCatalog = buildAchievementsCatalog(profile, candidateProfile);

  return NextResponse.json({
    profile: {
      ...(candidateProfile || {}),
      languages: achievementsCatalog.languages.map((item) => formatLanguageLabel(item) || item.title).filter(Boolean),
      achievements: achievementsCatalog.all,
      achievements_catalog: achievementsCatalog,
    },
  });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const read = await readProfileAndCandidateProfile(supabase, user.id);
  if ((read as any).error) return (read as any).error;
  const { profile, candidateProfile } = read as any;

  const achievementsInput = Array.isArray(body?.achievements)
    ? body.achievements
    : Array.isArray(body?.certifications)
      ? body.certifications
      : [];
  const normalizedAchievements = dedupeAchievements(
    achievementsInput.map(normalizeAchievement).filter(Boolean) as AchievementItem[]
  );
  const certifications = normalizedAchievements.filter((item) => item.category === "certificacion");
  const languages = normalizedAchievements
    .filter((item) => item.category === "idioma")
    .map((item) => normalizeText(item.language || item.title))
    .filter(Boolean);

  const [candidateProfileColumns, profileColumns] = await Promise.all([
    getTableColumns(supabase, "candidate_profiles"),
    getTableColumns(supabase, "profiles"),
  ]);

  const payload: Record<string, any> = {
    user_id: user.id,
    summary: typeof body?.summary === "string" ? body.summary : candidateProfile?.summary ?? null,
    updated_at: new Date().toISOString(),
  };
  if (candidateProfileColumns.has("education")) {
    payload.education = Array.isArray(body?.education) ? body.education : Array.isArray(candidateProfile?.education) ? candidateProfile.education : [];
  }
  if (candidateProfileColumns.has("achievements")) payload.achievements = normalizedAchievements;
  if (candidateProfileColumns.has("other_achievements") && !candidateProfileColumns.has("achievements")) {
    payload.other_achievements = normalizedAchievements;
  }
  if (candidateProfileColumns.has("certifications")) payload.certifications = certifications;

  let writeError: any = null;
  let nextCandidateProfile: any = null;
  if (candidateProfile?.id) {
    const res = await supabase.from("candidate_profiles").update(payload).eq("id", candidateProfile.id).select("*").single();
    writeError = res.error;
    nextCandidateProfile = res.data;
  } else {
    const res = await supabase.from("candidate_profiles").insert(payload).select("*").single();
    writeError = res.error;
    nextCandidateProfile = res.data;
  }

  if (writeError) {
    return NextResponse.json({ error: writeError.message }, { status: 400 });
  }

  if (profileColumns.has("languages") && (Array.isArray(profile?.languages) || languages.length > 0)) {
    const profileUpdate = await supabase
      .from("profiles")
      .update({ languages, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (profileUpdate.error && !String(profileUpdate.error.message || "").toLowerCase().includes("languages")) {
      return NextResponse.json({ error: profileUpdate.error.message }, { status: 400 });
    }
  }

  const achievementsCatalog = buildAchievementsCatalog({ ...(profile || {}), languages }, nextCandidateProfile);
  return NextResponse.json({
    ok: true,
    profile: {
      ...(nextCandidateProfile || {}),
      languages: achievementsCatalog.languages.map((item) => formatLanguageLabel(item) || item.title).filter(Boolean),
      achievements: achievementsCatalog.all,
      achievements_catalog: achievementsCatalog,
    },
  });
}
