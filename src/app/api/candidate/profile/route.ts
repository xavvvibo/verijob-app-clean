import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { buildCandidateProfileCompletionModel } from "@/lib/candidate/profile-completion";
import { normalizeCandidatePhone } from "@/lib/phone";
import { buildIdentityRecord } from "@/lib/security/identity";
import { buildCandidateExperienceTrustTimeline } from "@/lib/candidate/experience-trust";

const PROFILE_PERSONAL_FIELDS = [
  "full_name",
  "phone",
  "title",
  "location",
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
  const profileLanguages: AchievementItem[] = [];

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
  const [profileRes, candidateProfileRes, identityRes, experienceCountRes, evidenceCountRes, profileExperiencesRes, employmentRecordsRes, verificationSummariesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("candidate_identities")
      .select("user_id, identity_type, identity_masked")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profile_experiences").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("evidences").select("id", { count: "exact", head: true }).eq("uploaded_by", userId),
    supabase
      .from("profile_experiences")
      .select("id, role_title, company_name, start_date, end_date, description, matched_verification_id, created_at")
      .eq("user_id", userId)
      .order("start_date", { ascending: false }),
    supabase
      .from("employment_records")
      .select("id, position, company_name_freeform, start_date, end_date, verification_status, last_verification_request_id")
      .eq("candidate_id", userId)
      .order("start_date", { ascending: false }),
    supabase
      .from("verification_summary")
      .select("verification_id, status, evidence_count")
      .eq("candidate_id", userId),
  ]);

  if (profileRes.error) {
    return { error: NextResponse.json({ error: profileRes.error.message }, { status: 400 }) };
  }
  if (candidateProfileRes.error) {
    return { error: NextResponse.json({ error: candidateProfileRes.error.message }, { status: 400 }) };
  }
  if (identityRes.error) {
    return { error: NextResponse.json({ error: identityRes.error.message }, { status: 400 }) };
  }
  if (experienceCountRes.error) {
    return { error: NextResponse.json({ error: experienceCountRes.error.message }, { status: 400 }) };
  }
  if (evidenceCountRes.error) {
    return { error: NextResponse.json({ error: evidenceCountRes.error.message }, { status: 400 }) };
  }
  if (profileExperiencesRes.error) {
    return { error: NextResponse.json({ error: profileExperiencesRes.error.message }, { status: 400 }) };
  }
  if (employmentRecordsRes.error) {
    return { error: NextResponse.json({ error: employmentRecordsRes.error.message }, { status: 400 }) };
  }
  if (verificationSummariesRes.error) {
    return { error: NextResponse.json({ error: verificationSummariesRes.error.message }, { status: 400 }) };
  }

  return {
    profile: profileRes.data || null,
    candidateProfile: candidateProfileRes.data || null,
    identity: identityRes.data || null,
    profileExperiences: profileExperiencesRes.data || [],
    employmentRecords: employmentRecordsRes.data || [],
    verificationSummaries: verificationSummariesRes.data || [],
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
      if (field === "phone") {
        const normalizedPhone = normalizeCandidatePhone(body?.[field]);
        next[field] = normalizedPhone.ok === true ? normalizedPhone.normalized : currentProfile?.[field] ?? null;
      } else {
        next[field] = normalizeNullableText(body?.[field], 160);
      }
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
  const { profile, candidateProfile, identity, counts, profileExperiences, employmentRecords, verificationSummaries } = read as any;
  const achievementsCatalog = buildAchievementsCatalog(profile, candidateProfile);
  const experienceTimeline = buildCandidateExperienceTrustTimeline({
    profileExperiences: profileExperiences || [],
    employmentRecords: employmentRecords || [],
    verificationSummaries: verificationSummaries || [],
  });
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
      address_line1: null,
      address_line2: null,
      city: null,
      region: null,
      postal_code: null,
      country: null,
      identity_type: identity?.identity_type || null,
      identity_masked: identity?.identity_masked || null,
      has_identity: Boolean(identity?.identity_type && identity?.identity_masked),
    },
    profile: {
      ...(candidateProfile || {}),
      languages: achievementsCatalog.languages.map((item) => formatLanguageLabel(item) || item.title).filter(Boolean),
      achievements: achievementsCatalog.all,
      achievements_catalog: achievementsCatalog,
      experience_timeline: experienceTimeline,
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

  const hasAchievementsInput = Object.prototype.hasOwnProperty.call(body || {}, "achievements");
  const hasCertificationsInput = Object.prototype.hasOwnProperty.call(body || {}, "certifications");
  const achievementsInput = Array.isArray(body?.achievements)
    ? body.achievements
    : Array.isArray(body?.certifications)
      ? body.certifications
      : [];
  const hasCandidateProfileInput = ["summary", "education", "achievements", "certifications"].some((key) =>
    Object.prototype.hasOwnProperty.call(body || {}, key)
  );
  const normalizedAchievements = dedupeAchievements(
    achievementsInput.map(normalizeAchievement).filter(Boolean) as AchievementItem[]
  );
  const certifications = normalizedAchievements.filter((item) => item.category === "certificacion");

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
    if ((hasAchievementsInput || hasCertificationsInput) && CANDIDATE_PROFILE_MUTABLE_FIELDS.includes("achievements")) {
      payload.achievements = normalizedAchievements;
    }
    if (
      (hasAchievementsInput || hasCertificationsInput) &&
      CANDIDATE_PROFILE_MUTABLE_FIELDS.includes("other_achievements") &&
      !CANDIDATE_PROFILE_MUTABLE_FIELDS.includes("achievements")
    ) {
      payload.other_achievements = normalizedAchievements;
    }
    if ((hasAchievementsInput || hasCertificationsInput) && CANDIDATE_PROFILE_MUTABLE_FIELDS.includes("certifications")) {
      payload.certifications = certifications;
    }

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
    if (field === "phone") {
      const normalizedPhone = normalizeCandidatePhone(body?.[field]);
      if (normalizedPhone.ok === false) {
        return NextResponse.json(
          { error: "invalid_phone", details: normalizedPhone.error },
          { status: 400 }
        );
      }
      nextProfilePatch[field] = normalizedPhone.normalized;
      continue;
    }
    nextProfilePatch[field] = normalizeNullableText(body?.[field], 160);
  }
  const clearIdentity = body?.clear_identity === true;
  const hasIdentityValueInput =
    Object.prototype.hasOwnProperty.call(body || {}, "identity_value") &&
    typeof body?.identity_value === "string" &&
    body.identity_value.trim().length > 0;
  if (Object.keys(nextProfilePatch).length) {
    nextProfilePatch.updated_at = new Date().toISOString();
    const profileUpdate = await admin
      .from("profiles")
      .update(nextProfilePatch)
      .eq("id", user.id)
      .select("id, full_name, phone, title, location")
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

  let requestedIdentitySnapshot:
    | { identity_type: string; identity_masked: string }
    | null
    | undefined = undefined;

  if (clearIdentity) {
    const deleteIdentity = await admin.from("candidate_identities").delete().eq("user_id", user.id);
    if (deleteIdentity.error) {
      return NextResponse.json(
        {
          error: "candidate_identity_delete_failed",
          details: deleteIdentity.error.message,
        },
        { status: 400 }
      );
    }
    requestedIdentitySnapshot = null;
  } else if (hasIdentityValueInput) {
    const identityRecord = buildIdentityRecord({
      type: body?.identity_type,
      value: body?.identity_value,
    });
    if (!identityRecord.identityType || !identityRecord.identityMasked || !identityRecord.identityHash) {
      return NextResponse.json(
        {
          error: "invalid_identity",
          details: "El documento de identidad no es válido.",
        },
        { status: 400 }
      );
    }
    const upsertIdentity = await admin
      .from("candidate_identities")
      .upsert(
        {
          user_id: user.id,
          identity_type: identityRecord.identityType,
          identity_hash: identityRecord.identityHash,
          identity_masked: identityRecord.identityMasked,
        },
        { onConflict: "user_id" }
      )
      .select("user_id, identity_type, identity_masked")
      .maybeSingle();
    if (upsertIdentity.error) {
      return NextResponse.json(
        {
          error: "candidate_identity_write_failed",
          details: upsertIdentity.error.message,
        },
        { status: 400 }
      );
    }
    if (!upsertIdentity.data) {
      return NextResponse.json(
        {
          error: "candidate_identity_write_no_rows",
          details: "No se pudo persistir la identidad del candidato.",
        },
        { status: 400 }
      );
    }
    requestedIdentitySnapshot = {
      identity_type: identityRecord.identityType,
      identity_masked: identityRecord.identityMasked,
    };
  }

  const reread = await readProfileAndCandidateProfile(admin, user.id);
  if ((reread as any).error) return (reread as any).error;
  const persistedProfile = (reread as any).profile || null;
  const persistedCandidateProfile = (reread as any).candidateProfile || null;
  const persistedIdentity = (reread as any).identity || null;
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
    if (hasAchievementsInput || hasCertificationsInput) {
      const requestedAchievements = normalizedAchievements;
      const persistedAchievements = Array.isArray(persistedCandidateProfile?.achievements)
        ? persistedCandidateProfile.achievements.map(normalizeAchievement).filter(Boolean)
        : Array.isArray(persistedCandidateProfile?.other_achievements)
          ? persistedCandidateProfile.other_achievements.map(normalizeAchievement).filter(Boolean)
          : [];
      if (!sameJson(requestedAchievements, persistedAchievements)) {
        return NextResponse.json(
          {
            error: "candidate_profile_persistence_mismatch",
            details: "Los idiomas y logros no quedaron persistidos tras la relectura.",
          },
          { status: 409 }
        );
      }
    }
  }

  if (requestedIdentitySnapshot === null) {
    if (persistedIdentity) {
      return NextResponse.json(
        {
          error: "candidate_identity_persistence_mismatch",
          details: "El documento de identidad no se eliminó tras la relectura.",
        },
        { status: 409 }
      );
    }
  } else if (requestedIdentitySnapshot) {
    if (
      (persistedIdentity?.identity_type ?? null) !== requestedIdentitySnapshot.identity_type ||
      (persistedIdentity?.identity_masked ?? null) !== requestedIdentitySnapshot.identity_masked
    ) {
      return NextResponse.json(
        {
          error: "candidate_identity_persistence_mismatch",
          details: "El documento de identidad no quedó persistido tras la relectura.",
        },
        { status: 409 }
      );
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
      address_line1: null,
      address_line2: null,
      city: null,
      region: null,
      postal_code: null,
      country: null,
      identity_type: persistedIdentity?.identity_type || null,
      identity_masked: persistedIdentity?.identity_masked || null,
      has_identity: Boolean(persistedIdentity?.identity_type && persistedIdentity?.identity_masked),
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
