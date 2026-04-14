import { getCandidatePlanCapabilities } from "@/lib/billing/planCapabilities";

export type CandidateSkillSourceType = "self" | "experience" | "company" | "peer";

export type CandidateSkillItem = {
  id: string;
  name: string;
  source_type: CandidateSkillSourceType;
  verified: boolean;
  verification_type: string | null;
};

export type CandidateExperienceVisibilitySetting = {
  visible: boolean;
  featured: boolean;
};

export type CandidatePublicProfileSettings = {
  experiences: Record<string, CandidateExperienceVisibilitySetting>;
};

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

export function readCandidateRawConfig(candidateProfile: any) {
  return asObject(candidateProfile?.raw_cv_json);
}

export function mergeCandidateRawConfig(candidateProfile: any, patch: Record<string, any>) {
  return {
    ...readCandidateRawConfig(candidateProfile),
    ...patch,
  };
}

export function normalizeCandidateSkills(input: unknown): CandidateSkillItem[] {
  return (Array.isArray(input) ? input : [])
    .map((item: any, index) => {
      const name = normalizeText(item?.name || item?.label || item?.skill);
      if (!name) return null;
      const sourceType = normalizeText(item?.source_type || item?.sourceType).toLowerCase();
      const normalizedSourceType: CandidateSkillSourceType =
        sourceType === "experience" || sourceType === "company" || sourceType === "peer"
          ? (sourceType as CandidateSkillSourceType)
          : "self";
      return {
        id: normalizeText(item?.id) || `skill-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name,
        source_type: normalizedSourceType,
        verified: Boolean(item?.verified),
        verification_type: normalizeText(item?.verification_type || item?.verificationType) || null,
      } satisfies CandidateSkillItem;
    })
    .filter(Boolean) as CandidateSkillItem[];
}

export function readCandidateSkills(candidateProfile: any) {
  const raw = readCandidateRawConfig(candidateProfile);
  return normalizeCandidateSkills(raw.manual_skills);
}

export function readPublicProfileSettings(candidateProfile: any): CandidatePublicProfileSettings {
  const raw = asObject(readCandidateRawConfig(candidateProfile).public_profile_settings);
  const experiences = asObject(raw.experiences);
  const normalized: Record<string, CandidateExperienceVisibilitySetting> = {};

  for (const [key, value] of Object.entries(experiences)) {
    const item = asObject(value);
    normalized[key] = {
      visible: item.visible !== false,
      featured: item.featured === true,
    };
  }

  return { experiences: normalized };
}

export function normalizePublicProfileSettings(input: unknown): CandidatePublicProfileSettings {
  return readPublicProfileSettings({
    raw_cv_json: {
      public_profile_settings: input,
    },
  });
}

export function buildExperienceVisibilityKey(input: {
  employmentRecordId?: string | null;
  profileExperienceId?: string | null;
  fallbackId?: string | null;
}) {
  const employmentRecordId = normalizeText(input.employmentRecordId);
  if (employmentRecordId) return `employment:${employmentRecordId}`;
  const profileExperienceId = normalizeText(input.profileExperienceId);
  if (profileExperienceId) return `profile:${profileExperienceId}`;
  const fallbackId = normalizeText(input.fallbackId);
  if (fallbackId) return `item:${fallbackId}`;
  return "";
}

export function getExperienceVisibilitySetting(
  settings: CandidatePublicProfileSettings,
  input: {
    employmentRecordId?: string | null;
    profileExperienceId?: string | null;
    fallbackId?: string | null;
  },
) {
  const keys = [
    buildExperienceVisibilityKey({ employmentRecordId: input.employmentRecordId }),
    buildExperienceVisibilityKey({ profileExperienceId: input.profileExperienceId }),
    buildExperienceVisibilityKey({ fallbackId: input.fallbackId }),
  ].filter(Boolean);

  for (const key of keys) {
    const setting = settings.experiences[key];
    if (setting) return setting;
  }

  return null;
}

export function countFeaturedExperiences(settings: CandidatePublicProfileSettings) {
  return Object.values(settings.experiences).filter((item) => item?.featured).length;
}

export function countVisibleExperiences(settings: CandidatePublicProfileSettings) {
  return Object.values(settings.experiences).filter((item) => item?.visible !== false).length;
}

export function resolveCandidatePublicLimits(planRaw: unknown) {
  const capabilities = getCandidatePlanCapabilities(planRaw);
  return {
    work: capabilities.publicWorkExperiencesLimit,
    academic: capabilities.publicAcademicExperiencesLimit,
    featured: capabilities.publicFeaturedExperiencesLimit,
    label: capabilities.publicProfileExperienceLabel,
  };
}
