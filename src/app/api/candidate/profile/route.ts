import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

type AchievementCategory = "certificacion" | "premio" | "idioma" | "otro";

type AchievementItem = {
  title: string;
  issuer: string | null;
  date: string | null;
  description: string | null;
  category: AchievementCategory;
};

function normalizeAchievement(raw: any): AchievementItem | null {
  const title = normalizeText(raw?.title);
  const issuer = normalizeText(raw?.issuer) || null;
  const date = normalizeText(raw?.date) || null;
  const description = normalizeText(raw?.description) || null;
  const rawCategory = normalizeText(raw?.category).toLowerCase();
  const category: AchievementCategory =
    rawCategory === "idioma" || rawCategory === "premio" || rawCategory === "certificacion"
      ? (rawCategory as AchievementCategory)
      : "otro";
  if (!title && !issuer && !date && !description) return null;
  return {
    title,
    issuer,
    date,
    description,
    category,
  };
}

function dedupeAchievements(items: AchievementItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}|${normalizeText(item.title).toLowerCase()}|${normalizeText(item.issuer).toLowerCase()}|${normalizeText(item.date).toLowerCase()}`;
    if (!item.title && !item.issuer && !item.date && !item.description) return false;
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
      languages: achievementsCatalog.languages.map((item) => item.title),
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
    .map((item) => item.title)
    .filter(Boolean);

  const payload = {
    user_id: user.id,
    summary: typeof body?.summary === "string" ? body.summary : candidateProfile?.summary ?? null,
    education: Array.isArray(body?.education) ? body.education : Array.isArray(candidateProfile?.education) ? candidateProfile.education : [],
    achievements: normalizedAchievements,
    certifications,
    updated_at: new Date().toISOString(),
  };

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

  if (Array.isArray(profile?.languages) || languages.length > 0) {
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
      languages: achievementsCatalog.languages.map((item) => item.title),
      achievements: achievementsCatalog.all,
      achievements_catalog: achievementsCatalog,
    },
  });
}
