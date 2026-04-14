import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { buildCandidateProfileCompletionModel } from "@/lib/candidate/profile-completion";
import { normalizeCandidatePhone } from "@/lib/phone";
import { buildIdentityRecord } from "@/lib/security/identity";
import { buildCandidateExperienceTrustTimeline } from "@/lib/candidate/experience-trust";
import {
  readCandidateProfileCollections,
  replaceCandidateAchievementsCollection,
  replaceCandidateCertificationsCollection,
  replaceCandidateEducationCollection,
  replaceCandidateLanguagesCollection,
} from "@/lib/candidate/profile-collections";
import {
  mergeCandidateRawConfig,
  normalizeCandidateSkills,
  normalizePublicProfileSettings,
  readCandidateSkills,
  readPublicProfileSettings,
} from "@/lib/candidate/profile-visibility";
import { normalizeTrustBreakdown } from "@/lib/trust/trust-model";

const PROFILE_PERSONAL_FIELDS = ["full_name", "phone", "title", "location"] as const;

async function getTableColumns(admin: any, tableName: string) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);
  if (!error && Array.isArray(data) && data.length > 0) {
    return new Set(data.map((row: any) => String(row?.column_name || "")));
  }
  if (tableName === "candidate_profiles") {
    return new Set(["id", "user_id", "summary", "education", "trust_score", "trust_score_breakdown", "raw_cv_json"]);
  }
  if (tableName === "profiles") {
    return new Set(["id", "full_name", "phone", "title", "location", "updated_at"]);
  }
  return new Set<string>();
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeNullableText(value: unknown, max: number) {
  const normalized = normalizeText(value).slice(0, max);
  return normalized || null;
}

function sameJson(a: unknown, b: unknown) {
  return stableJsonStringify(a) === stableJsonStringify(b);
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJsonValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function extractMissingColumnName(error: any) {
  const message = String(error?.message || "");
  const match = message.match(/column ["']?([a-zA-Z0-9_]+)["']? .* does not exist/i);
  return match?.[1] ? String(match[1]) : null;
}

async function writeCandidateProfileRow(args: {
  admin: any;
  userId: string;
  candidateProfile: any;
  payload: Record<string, any>;
}) {
  const workingPayload = { ...args.payload };
  let attempts = 0;

  while (attempts < 4) {
    attempts += 1;
    const res = args.candidateProfile?.id
      ? await args.admin
          .from("candidate_profiles")
          .update(workingPayload)
          .eq("id", args.candidateProfile.id)
          .eq("user_id", args.userId)
          .select("*")
          .maybeSingle()
      : await args.admin
          .from("candidate_profiles")
          .insert(workingPayload)
          .select("*")
          .single();

    if (!res.error) {
      return res;
    }

    const missingColumn = extractMissingColumnName(res.error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(workingPayload, missingColumn) || missingColumn === "user_id") {
      return res;
    }
    delete workingPayload[missingColumn];
  }

  return { data: null, error: { message: "candidate_profile_write_retry_exhausted" } };
}

async function writeProfileRow(args: {
  admin: any;
  userId: string;
  payload: Record<string, any>;
  select: string;
}) {
  const workingPayload = { ...args.payload };
  let workingSelect = args.select;
  let attempts = 0;

  while (attempts < 4) {
    attempts += 1;
    const res = await args.admin
      .from("profiles")
      .update(workingPayload)
      .eq("id", args.userId)
      .select(workingSelect)
      .maybeSingle();

    if (!res.error) return res;

    const missingColumn = extractMissingColumnName(res.error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
      delete workingPayload[missingColumn];
      continue;
    }

    if (missingColumn && workingSelect.split(",").map((item) => item.trim()).includes(missingColumn)) {
      workingSelect = workingSelect
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item && item !== missingColumn)
        .join(",");
      if (!workingSelect) workingSelect = "id";
      continue;
    }

    return res;
  }

  return { data: null, error: { message: "profile_write_retry_exhausted" } };
}

async function readProfileAndCandidateProfile(supabase: any, userId: string) {
  const [
    profileRes,
    candidateProfileRes,
    identityRes,
    experienceCountRes,
    evidenceCountRes,
    profileExperiencesRes,
    employmentRecordsRes,
    verificationSummariesRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("candidate_identities").select("user_id, identity_type, identity_masked").eq("user_id", userId).maybeSingle(),
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

  for (const res of [
    profileRes,
    candidateProfileRes,
    identityRes,
    experienceCountRes,
    evidenceCountRes,
    profileExperiencesRes,
    employmentRecordsRes,
    verificationSummariesRes,
  ]) {
    if (res.error) {
      return { error: NextResponse.json({ error: res.error.message }, { status: 400 }) };
    }
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

function normalizeAchievementCategory(value: unknown) {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "idioma") return "idioma";
  if (raw === "certificacion" || raw === "certificación" || raw === "certification") return "certificacion";
  if (raw === "premio") return "premio";
  return "otro";
}

function normalizeCompatibilityLanguageItems(items: any[]) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      language_name: normalizeText(item?.language || item?.title || item?.language_name),
      proficiency_level: normalizeText(item?.level || item?.proficiency_level),
      notes: normalizeText(item?.description || item?.notes),
      is_native: false,
    }))
    .filter((item) => item.language_name);
}

function normalizeCompatibilityCertificationItems(items: any[]) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      name: normalizeText(item?.title || item?.name),
      issuer: normalizeText(item?.issuer),
      issue_date: normalizeText(item?.date || item?.issue_date),
      credential_id: normalizeText(item?.certificate_title || item?.credential_id),
      credential_url: normalizeText(item?.credential_url),
      notes: normalizeText(item?.description || item?.notes),
    }))
    .filter((item) => item.name || item.issuer || item.notes);
}

function normalizeCompatibilityAchievementItems(items: any[]) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      title: normalizeText(item?.title),
      description: normalizeText(item?.description),
      achievement_type: normalizeText(item?.category || item?.achievement_type),
      issuer: normalizeText(item?.issuer),
      achieved_at: normalizeText(item?.date || item?.achieved_at),
    }))
    .filter((item) => item.title || item.description || item.issuer);
}

function buildProfilePayload(candidateProfile: any, collections: Awaited<ReturnType<typeof readCandidateProfileCollections>>, experienceTimeline: any[]) {
  const normalizedTrustBreakdown = normalizeTrustBreakdown(candidateProfile?.trust_score_breakdown);
  return {
    ...(candidateProfile || {}),
    trust_score_breakdown: normalizedTrustBreakdown.display,
    trust_score_components: normalizedTrustBreakdown.display,
    education: collections.education,
    languages: collections.language_labels,
    certifications: collections.certifications,
    achievements: collections.achievements,
    achievements_catalog: collections.achievements_catalog,
    achievements_support: {
      languages: collections.support.languages,
      certifications: collections.support.certifications,
      achievements: collections.support.achievements,
    },
    skills: readCandidateSkills(candidateProfile),
    public_profile_settings: readPublicProfileSettings(candidateProfile),
    experience_timeline: experienceTimeline,
  };
}

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const read = await readProfileAndCandidateProfile(admin, user.id);
  if ((read as any).error) return (read as any).error;
  const { profile, candidateProfile, identity, counts, profileExperiences, employmentRecords, verificationSummaries } = read as any;
  const collections = await readCandidateProfileCollections(admin, user.id, { candidateProfile });
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
    achievementsCount: collections.achievements_catalog.all.length,
    educationCount: collections.education.length,
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
    profile: buildProfilePayload(candidateProfile, collections, experienceTimeline),
    profile_completion: profileCompletion,
    counts,
  });
}

export async function PUT(req: Request) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const body = await req.json().catch(() => ({}));
  const read = await readProfileAndCandidateProfile(admin, user.id);
  if ((read as any).error) return (read as any).error;
  const { profile, candidateProfile, counts } = read as any;
  const [candidateProfileColumns, profileColumns] = await Promise.all([
    getTableColumns(admin, "candidate_profiles"),
    getTableColumns(admin, "profiles"),
  ]);

  const requestedCandidateProfilePatch: Record<string, any> = { user_id: user.id };
  if (candidateProfileColumns.has("summary") && Object.prototype.hasOwnProperty.call(body || {}, "summary")) {
    requestedCandidateProfilePatch.summary = typeof body?.summary === "string" ? body.summary : candidateProfile?.summary ?? null;
  }
  if (candidateProfileColumns.has("raw_cv_json")) {
    const shouldWritePublicProfileSettings = Object.prototype.hasOwnProperty.call(body || {}, "public_profile_settings");
    const shouldWriteSkills = Object.prototype.hasOwnProperty.call(body || {}, "skills");
    if (shouldWritePublicProfileSettings || shouldWriteSkills) {
      requestedCandidateProfilePatch.raw_cv_json = mergeCandidateRawConfig(candidateProfile, {
        ...(shouldWritePublicProfileSettings
          ? { public_profile_settings: normalizePublicProfileSettings(body?.public_profile_settings) }
          : {}),
        ...(shouldWriteSkills
          ? { manual_skills: normalizeCandidateSkills(body?.skills) }
          : {}),
      });
    }
  }

  if (Object.keys(requestedCandidateProfilePatch).length > 1) {
    const res = await writeCandidateProfileRow({
      admin,
      userId: user.id,
      candidateProfile,
      payload: requestedCandidateProfilePatch,
    });
    if (res.error) {
      return NextResponse.json({ error: "candidate_profile_write_failed", details: res.error.message }, { status: 400 });
    }
  }

  const nextProfilePatch: Record<string, any> = {};
  for (const field of PROFILE_PERSONAL_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body || {}, field)) continue;
    if (field === "phone") {
      const normalizedPhone = normalizeCandidatePhone(body?.[field]);
      if (normalizedPhone.ok === false) {
        return NextResponse.json({ error: "invalid_phone", details: normalizedPhone.error }, { status: 400 });
      }
      nextProfilePatch[field] = normalizedPhone.normalized;
      continue;
    }
    nextProfilePatch[field] = normalizeNullableText(body?.[field], 160);
  }
  if (Object.keys(nextProfilePatch).length) {
    if (profileColumns.has("updated_at")) nextProfilePatch.updated_at = new Date().toISOString();
    const profileUpdate = await writeProfileRow({
      admin,
      userId: user.id,
      payload: nextProfilePatch,
      select: "id, full_name, phone, title, location",
    });
    if (profileUpdate.error) {
      return NextResponse.json({ error: "profile_update_failed", details: profileUpdate.error.message }, { status: 400 });
    }
    if (profileUpdate.data) Object.assign(profile, profileUpdate.data);
  }

  const achievementsInput = Array.isArray(body?.achievements) ? body.achievements : [];
  const requestedLanguages = Object.prototype.hasOwnProperty.call(body || {}, "languages")
    ? Array.isArray(body?.languages)
      ? body.languages
      : []
    : achievementsInput.filter((item: any) => normalizeAchievementCategory(item?.category) === "idioma");
  const requestedCertifications = Object.prototype.hasOwnProperty.call(body || {}, "certifications")
    ? Array.isArray(body?.certifications)
      ? body.certifications
      : []
    : achievementsInput.filter((item: any) => normalizeAchievementCategory(item?.category) === "certificacion");
  const requestedAchievements = achievementsInput.filter((item: any) => {
    const category = normalizeAchievementCategory(item?.category);
    return category === "premio" || category === "otro";
  });

  try {
    if (Object.prototype.hasOwnProperty.call(body || {}, "education")) {
      await replaceCandidateEducationCollection(admin, user.id, Array.isArray(body?.education) ? body.education : [], "manual");
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, "languages") || achievementsInput.length > 0) {
      await replaceCandidateLanguagesCollection(admin, user.id, normalizeCompatibilityLanguageItems(requestedLanguages), "manual");
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, "certifications") || achievementsInput.length > 0) {
      await replaceCandidateCertificationsCollection(admin, user.id, normalizeCompatibilityCertificationItems(requestedCertifications), "manual");
    }
    if (Array.isArray(body?.achievements)) {
      await replaceCandidateAchievementsCollection(admin, user.id, normalizeCompatibilityAchievementItems(requestedAchievements), "manual");
    }
  } catch (error: any) {
    return NextResponse.json({ error: "candidate_collection_write_failed", details: String(error?.message || error) }, { status: 400 });
  }

  const clearIdentity = body?.clear_identity === true;
  const hasIdentityValueInput =
    Object.prototype.hasOwnProperty.call(body || {}, "identity_value") &&
    typeof body?.identity_value === "string" &&
    body.identity_value.trim().length > 0;
  let requestedIdentitySnapshot:
    | { identity_type: string; identity_masked: string }
    | null
    | undefined = undefined;

  if (clearIdentity) {
    const deleteIdentity = await admin.from("candidate_identities").delete().eq("user_id", user.id);
    if (deleteIdentity.error) {
      return NextResponse.json({ error: "candidate_identity_delete_failed", details: deleteIdentity.error.message }, { status: 400 });
    }
    requestedIdentitySnapshot = null;
  } else if (hasIdentityValueInput) {
    const identityRecord = buildIdentityRecord({ type: body?.identity_type, value: body?.identity_value });
    if (!identityRecord.identityType || !identityRecord.identityMasked || !identityRecord.identityHash) {
      return NextResponse.json({ error: "invalid_identity", details: "El documento de identidad no es válido." }, { status: 400 });
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
    if (upsertIdentity.error || !upsertIdentity.data) {
      return NextResponse.json({ error: "candidate_identity_write_failed", details: upsertIdentity.error?.message || "identity_write_failed" }, { status: 400 });
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
  const persistedCollections = await readCandidateProfileCollections(admin, user.id, { candidateProfile: persistedCandidateProfile });

  const requestedPersonalSnapshot = buildRequestedPersonalSnapshot(body, profile);
  const personalMismatchField = validatePersistedPersonalSnapshot({
    requested: requestedPersonalSnapshot,
    persisted: persistedProfile,
  });
  if (personalMismatchField) {
    return NextResponse.json({ error: "profile_persistence_mismatch", details: `El campo ${personalMismatchField} no quedó persistido tras la relectura.` }, { status: 409 });
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "summary")) {
    const requestedSummary = typeof body?.summary === "string" ? body.summary : candidateProfile?.summary ?? null;
    const persistedSummary = persistedCandidateProfile?.summary ?? null;
    if ((requestedSummary ?? null) !== (persistedSummary ?? null)) {
      return NextResponse.json({ error: "candidate_profile_persistence_mismatch", details: "El resumen profesional no quedó persistido tras la relectura." }, { status: 409 });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "skills")) {
    const requestedSkills = normalizeCandidateSkills(body?.skills);
    const persistedSkills = readCandidateSkills(persistedCandidateProfile);
    if (!sameJson(requestedSkills, persistedSkills)) {
      return NextResponse.json({ error: "candidate_skills_persistence_mismatch", details: "Las skills manuales no quedaron persistidas tras la relectura." }, { status: 409 });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "public_profile_settings")) {
    const requestedSettings = normalizePublicProfileSettings(body?.public_profile_settings);
    const persistedSettings = readPublicProfileSettings(persistedCandidateProfile);
    if (!sameJson(requestedSettings, persistedSettings)) {
      return NextResponse.json({ error: "candidate_visibility_persistence_mismatch", details: "La configuración de visibilidad pública no quedó persistida tras la relectura." }, { status: 409 });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "education")) {
    const requestedEducation = (Array.isArray(body?.education) ? body.education : []).map((item: any) => ({
      title: normalizeText(item?.title),
      institution: normalizeText(item?.institution),
      field_of_study: normalizeText(item?.field_of_study),
      start_date: normalizeText(item?.start_date),
      end_date: item?.in_progress ? "" : normalizeText(item?.end_date),
      description: normalizeText(item?.description),
      in_progress: Boolean(item?.in_progress),
    }));
    const persistedEducation = persistedCollections.education.map((item) => ({
      title: normalizeText(item.title),
      institution: normalizeText(item.institution),
      field_of_study: normalizeText(item.field_of_study),
      start_date: normalizeText(item.start_date),
      end_date: item.in_progress ? "" : normalizeText(item.end_date),
      description: normalizeText(item.description),
      in_progress: Boolean(item.in_progress),
    }));
    if (!sameJson(requestedEducation, persistedEducation)) {
      return NextResponse.json({ error: "candidate_collection_persistence_mismatch", details: "La formación no quedó persistida tras la relectura." }, { status: 409 });
    }
  }

  if (requestedIdentitySnapshot === null && persistedIdentity) {
    return NextResponse.json({ error: "candidate_identity_persistence_mismatch", details: "El documento de identidad no se eliminó tras la relectura." }, { status: 409 });
  }
  if (requestedIdentitySnapshot && ((persistedIdentity?.identity_type ?? null) !== requestedIdentitySnapshot.identity_type || (persistedIdentity?.identity_masked ?? null) !== requestedIdentitySnapshot.identity_masked)) {
    return NextResponse.json({ error: "candidate_identity_persistence_mismatch", details: "El documento de identidad no quedó persistido tras la relectura." }, { status: 409 });
  }

  const experienceTimeline = buildCandidateExperienceTrustTimeline({
    profileExperiences: (reread as any).profileExperiences || [],
    employmentRecords: (reread as any).employmentRecords || [],
    verificationSummaries: (reread as any).verificationSummaries || [],
  });
  const profileCompletion = buildCandidateProfileCompletionModel({
    profile: persistedProfile,
    candidateProfile: persistedCandidateProfile,
    experienceCount: Number(persistedCounts?.experience_count || 0),
    evidenceCount: Number(persistedCounts?.evidence_count || 0),
    achievementsCount: persistedCollections.achievements_catalog.all.length,
    educationCount: persistedCollections.education.length,
  });

  return NextResponse.json({
    ok: true,
    personal_profile: {
      full_name: persistedProfile?.full_name || null,
      phone: persistedProfile?.phone || null,
      title: persistedProfile?.title || null,
      location: persistedProfile?.location || null,
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
    profile: buildProfilePayload(persistedCandidateProfile, persistedCollections, experienceTimeline),
    profile_completion: profileCompletion,
    counts: persistedCounts,
  });
}
