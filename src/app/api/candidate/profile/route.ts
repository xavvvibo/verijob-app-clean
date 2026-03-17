import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { buildCandidateProfileCompletionModel } from "@/lib/candidate/profile-completion";
import { buildIdentityRecord, normalizeIdentityType, normalizeIdentityValue } from "@/lib/security/identity";

const PROFILE_PERSONAL_FIELDS = [
  "full_name",
  "phone",
  "title",
  "location",
  "address_line1",
  "address_line2",
  "city",
  "region",
  "postal_code",
  "country",
] as const;

const CANDIDATE_PROFILE_MUTABLE_FIELDS = [
  "summary",
  "education",
  "achievements",
  "other_achievements",
  "certifications",
  "updated_at",
] as const;

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeNullableText(value: unknown, max: number) {
  const normalized = normalizeText(value).slice(0, max);
  return normalized || null;
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
  const otherAchievements = Array.isArray(candidateProfile?.other_achievements)
    ? candidateProfile.other_achievements.map(normalizeAchievement).filter(Boolean)
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

  const merged = dedupeAchievements([
    ...profileLanguages,
    ...achievements,
    ...otherAchievements,
    ...certificationsLegacy,
  ] as AchievementItem[]);
  return {
    all: merged,
    languages: merged.filter((item) => item.category === "idioma"),
    certifications: merged.filter((item) => item.category === "certificacion"),
    awards: merged.filter((item) => item.category === "premio"),
    others: merged.filter((item) => item.category === "otro"),
  };
}

async function readProfileAndCandidateProfile(supabase: any, userId: string) {
  const [profileRes, candidateProfileRes, experienceCountRes, evidenceCountRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_experiences").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("evidences").select("id", { count: "exact", head: true }).eq("uploaded_by", userId),
  ]);

  if (profileRes.error) {
    return { error: NextResponse.json({ error: profileRes.error.message }, { status: 400 }) };
  }
  if (candidateProfileRes.error) {
    return { error: NextResponse.json({ error: candidateProfileRes.error.message }, { status: 400 }) };
  }
  if (experienceCountRes.error) {
    return { error: NextResponse.json({ error: experienceCountRes.error.message }, { status: 400 }) };
  }
  if (evidenceCountRes.error) {
    return { error: NextResponse.json({ error: evidenceCountRes.error.message }, { status: 400 }) };
  }

  return {
    profile: profileRes.data || null,
    candidateProfile: candidateProfileRes.data || null,
    counts: {
      experience_count: Number(experienceCountRes.count || 0),
      evidence_count: Number(evidenceCountRes.count || 0),
    },
  };
}

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildRequestedPersonalSnapshot(body: any, currentProfile: any) {
  const next: Record<string, any> = {};
  for (const field of PROFILE_PERSONAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body || {}, field)) {
      next[field] = normalizeNullableText(body?.[field], field === "phone" ? 50 : field === "postal_code" ? 40 : field === "city" || field === "region" ? 120 : field === "country" ? 80 : 160);
    } else {
      next[field] = currentProfile?.[field] ?? null;
    }
  }
  return next;
}

function validatePersistedPersonalSnapshot(params: {
  requested: Record<string, any>;
  persisted: any;
}) {
  for (const field of PROFILE_PERSONAL_FIELDS) {
    if ((params.requested?.[field] ?? null) !== (params.persisted?.[field] ?? null)) {
      return field;
    }
  }
  return null;
}

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const read = await readProfileAndCandidateProfile(admin, user.id);
  if ((read as any).error) return (read as any).error;
  const { profile, candidateProfile, counts } = read as any;
  const achievementsCatalog = buildAchievementsCatalog(profile, candidateProfile);
  const profileCompletion = buildCandidateProfileCompletionModel({
    profile,
    candidateProfile,
    experienceCount: Number(counts?.experience_count || 0),
    evidenceCount: Number(counts?.evidence_count || 0),
    achievementsCount: achievementsCatalog.all.length,
  });

  return NextResponse.json({
    personal_profile: {
      full_name: profile?.full_name || null,
      phone: profile?.phone || null,
      title: profile?.title || null,
      location: profile?.location || null,
      address_line1: profile?.address_line1 || null,
      address_line2: profile?.address_line2 || null,
      city: profile?.city || null,
      region: profile?.region || null,
      postal_code: profile?.postal_code || null,
      country: profile?.country || null,
      identity_type: profile?.identity_type || null,
      identity_masked: profile?.identity_masked || null,
      has_identity: Boolean(profile?.identity_hash),
    },
    profile: {
      ...(candidateProfile || {}),
      languages: achievementsCatalog.languages.map((item) => formatLanguageLabel(item) || item.title).filter(Boolean),
      achievements: achievementsCatalog.all,
      achievements_catalog: achievementsCatalog,
    },
    profile_completion: profileCompletion,
    counts,
  });
}

export async function PUT(req: Request) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const body = await req.json().catch(() => ({}));
  const read = await readProfileAndCandidateProfile(admin, user.id);
  if ((read as any).error) return (read as any).error;
  const { profile, candidateProfile, counts } = read as any;

  const achievementsInput = Array.isArray(body?.achievements)
    ? body.achievements
    : Array.isArray(body?.certifications)
      ? body.certifications
      : [];
  const hasCandidateProfileInput = ["summary", "education", "achievements", "certifications"].some((key) =>
    Object.prototype.hasOwnProperty.call(body || {}, key)
  );
  const hasAchievementsInput = ["achievements", "certifications"].some((key) =>
    Object.prototype.hasOwnProperty.call(body || {}, key)
  );
  const normalizedAchievements = dedupeAchievements(
    achievementsInput.map(normalizeAchievement).filter(Boolean) as AchievementItem[]
  );
  const certifications = normalizedAchievements.filter((item) => item.category === "certificacion");
  const languages = normalizedAchievements
    .filter((item) => item.category === "idioma")
    .map((item) => normalizeText(item.language || item.title))
    .filter(Boolean);

  let writeError: any = null;
  let nextCandidateProfile: any = candidateProfile || null;
  if (hasCandidateProfileInput) {
    const payload: Record<string, any> = {
      user_id: user.id,
      summary: typeof body?.summary === "string" ? body.summary : candidateProfile?.summary ?? null,
      updated_at: new Date().toISOString(),
    };
    if (CANDIDATE_PROFILE_MUTABLE_FIELDS.includes("education")) {
      payload.education = Array.isArray(body?.education)
        ? body.education
        : Array.isArray(candidateProfile?.education)
          ? candidateProfile.education
          : [];
    }
    if (CANDIDATE_PROFILE_MUTABLE_FIELDS.includes("achievements")) payload.achievements = normalizedAchievements;
    if (CANDIDATE_PROFILE_MUTABLE_FIELDS.includes("other_achievements") && !CANDIDATE_PROFILE_MUTABLE_FIELDS.includes("achievements")) {
      payload.other_achievements = normalizedAchievements;
    }
    if (CANDIDATE_PROFILE_MUTABLE_FIELDS.includes("certifications")) payload.certifications = certifications;

    if (candidateProfile?.id) {
      const res = await admin
        .from("candidate_profiles")
        .update(payload)
        .eq("id", candidateProfile.id)
        .eq("user_id", user.id)
        .select("*")
        .maybeSingle();
      writeError = res.error;
      nextCandidateProfile = res.data;
      if (!writeError && !nextCandidateProfile) {
        writeError = { message: "candidate_profile_update_no_rows" };
      }
    } else {
      const res = await admin
        .from("candidate_profiles")
        .insert(payload)
        .select("*")
        .single();
      writeError = res.error;
      nextCandidateProfile = res.data;
    }
  }

  if (writeError) {
    return NextResponse.json(
      { error: "candidate_profile_write_failed", details: writeError.message },
      { status: 400 }
    );
  }

  const nextProfilePatch: Record<string, any> = {};
  for (const field of PROFILE_PERSONAL_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body || {}, field)) continue;
    nextProfilePatch[field] = normalizeNullableText(
      body?.[field],
      field === "phone" ? 50 : field === "postal_code" ? 40 : field === "city" || field === "region" ? 120 : field === "country" ? 80 : 160
    );
  }
  const hasIdentityInput =
    Object.prototype.hasOwnProperty.call(body || {}, "identity_type") ||
    Object.prototype.hasOwnProperty.call(body || {}, "identity_value");
  if (hasIdentityInput) {
    const rawIdentityType = body?.identity_type;
    const rawIdentityValue = typeof body?.identity_value === "string" ? body.identity_value : "";
    const identityType = normalizeIdentityType(rawIdentityType);
    const identityValue = normalizeIdentityValue(rawIdentityValue);
    const wantsClear = !normalizeText(rawIdentityType) && !normalizeText(rawIdentityValue);
    if (wantsClear) {
      nextProfilePatch.identity_type = null;
      nextProfilePatch.identity_masked = null;
      nextProfilePatch.identity_hash = null;
    } else if (!identityType || !identityValue) {
      return NextResponse.json(
        { error: "invalid_identity_value", details: "El documento debe tener al menos 5 caracteres alfanuméricos válidos." },
        { status: 400 }
      );
    } else {
      const identity = buildIdentityRecord({ type: identityType, value: identityValue });
      if (!identity.identityType || !identity.identityMasked || !identity.identityHash) {
        return NextResponse.json(
          { error: "identity_hash_failed", details: "No se pudo generar el hash interno del documento." },
          { status: 400 }
        );
      }
      nextProfilePatch.identity_type = identity.identityType;
      nextProfilePatch.identity_masked = identity.identityMasked;
      nextProfilePatch.identity_hash = identity.identityHash;
    }
  }
  if (hasAchievementsInput || Array.isArray(profile?.languages) || languages.length > 0) {
    nextProfilePatch.languages = languages;
  }
  if (Object.keys(nextProfilePatch).length) {
    nextProfilePatch.updated_at = new Date().toISOString();
    const profileUpdate = await admin
      .from("profiles")
      .update(nextProfilePatch)
      .eq("id", user.id)
      .select("id, full_name, phone, title, location, address_line1, address_line2, city, region, postal_code, country, identity_type, identity_masked, identity_hash, languages")
      .maybeSingle();
    if (profileUpdate.error) {
      return NextResponse.json(
        { error: "profile_update_failed", details: profileUpdate.error.message },
        { status: 400 }
      );
    }
    if (!profileUpdate.data) {
      return NextResponse.json(
        { error: "profile_update_no_rows", details: "No se actualizó ninguna fila en profiles." },
        { status: 400 }
      );
    }
    Object.assign(profile, profileUpdate.data || {});
  }

  const reread = await readProfileAndCandidateProfile(admin, user.id);
  if ((reread as any).error) return (reread as any).error;
  const persistedProfile = (reread as any).profile || null;
  const persistedCandidateProfile = (reread as any).candidateProfile || null;
  const persistedCounts = (reread as any).counts || counts;

  const requestedPersonalSnapshot = buildRequestedPersonalSnapshot(body, profile);
  const personalMismatchField = validatePersistedPersonalSnapshot({
    requested: requestedPersonalSnapshot,
    persisted: persistedProfile,
  });
  if (personalMismatchField) {
    return NextResponse.json(
      {
        error: "profile_persistence_mismatch",
        details: `El campo ${personalMismatchField} no quedó persistido tras la relectura.`,
      },
      { status: 409 }
    );
  }

  if (hasIdentityInput) {
    const requestedIdentityType = nextProfilePatch.identity_type ?? null;
    const requestedIdentityMasked = nextProfilePatch.identity_masked ?? null;
    const persistedIdentityType = persistedProfile?.identity_type ?? null;
    const persistedIdentityMasked = persistedProfile?.identity_masked ?? null;
    if (requestedIdentityType !== persistedIdentityType || requestedIdentityMasked !== persistedIdentityMasked) {
      return NextResponse.json(
        {
          error: "identity_persistence_mismatch",
          details: "La identidad no quedó persistida correctamente tras la relectura.",
        },
        { status: 409 }
      );
    }
  }

  if (hasCandidateProfileInput) {
    const requestedSummary = typeof body?.summary === "string" ? body.summary : candidateProfile?.summary ?? null;
    const persistedSummary = persistedCandidateProfile?.summary ?? null;
    if ((requestedSummary ?? null) !== (persistedSummary ?? null)) {
      return NextResponse.json(
        {
          error: "candidate_profile_persistence_mismatch",
          details: "El resumen profesional no quedó persistido tras la relectura.",
        },
        { status: 409 }
      );
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, "education")) {
      const requestedEducation = Array.isArray(body?.education) ? body.education : [];
      const persistedEducation = Array.isArray(persistedCandidateProfile?.education) ? persistedCandidateProfile.education : [];
      if (!sameJson(requestedEducation, persistedEducation)) {
        return NextResponse.json(
          {
            error: "candidate_profile_persistence_mismatch",
            details: "La formación no quedó persistida tras la relectura.",
          },
          { status: 409 }
        );
      }
    }
  }

  const nextProfile = persistedProfile;
  const achievementsCatalog = buildAchievementsCatalog(nextProfile, persistedCandidateProfile);
  const profileCompletion = buildCandidateProfileCompletionModel({
    profile: nextProfile,
    candidateProfile: persistedCandidateProfile,
    experienceCount: Number(persistedCounts?.experience_count || 0),
    evidenceCount: Number(persistedCounts?.evidence_count || 0),
    achievementsCount: achievementsCatalog.all.length,
  });
  return NextResponse.json({
    ok: true,
    personal_profile: {
      full_name: nextProfile?.full_name || null,
      phone: nextProfile?.phone || null,
      title: nextProfile?.title || null,
      location: nextProfile?.location || null,
      address_line1: nextProfile?.address_line1 || null,
      address_line2: nextProfile?.address_line2 || null,
      city: nextProfile?.city || null,
      region: nextProfile?.region || null,
      postal_code: nextProfile?.postal_code || null,
      country: nextProfile?.country || null,
      identity_type: nextProfile?.identity_type || null,
      identity_masked: nextProfile?.identity_masked || null,
      has_identity: Boolean(nextProfile?.identity_hash),
    },
    profile: {
      ...(persistedCandidateProfile || {}),
      languages: achievementsCatalog.languages.map((item) => formatLanguageLabel(item) || item.title).filter(Boolean),
      achievements: achievementsCatalog.all,
      achievements_catalog: achievementsCatalog,
    },
    profile_completion: profileCompletion,
    counts: persistedCounts,
  });
}
