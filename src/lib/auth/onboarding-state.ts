function coerceBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return Boolean(value);
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function hasCompleteCandidateName(value: unknown) {
  const parts = normalizeText(value)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 2;
}

function hasProfessionalTitle(value: unknown) {
  return normalizeText(value).length > 0;
}

function resolveExperienceCount(input: {
  experienceCount?: unknown;
  experience_count?: unknown;
  hasExperience?: unknown;
  has_experience?: unknown;
}) {
  const explicitCount =
    typeof input.experienceCount !== "undefined"
      ? Number(input.experienceCount || 0)
      : typeof input.experience_count !== "undefined"
        ? Number(input.experience_count || 0)
        : null;
  if (explicitCount !== null && Number.isFinite(explicitCount)) return explicitCount;
  if (typeof input.hasExperience !== "undefined") return coerceBoolean(input.hasExperience) ? 1 : 0;
  if (typeof input.has_experience !== "undefined") return coerceBoolean(input.has_experience) ? 1 : 0;
  return null;
}

export function resolveCandidateMinimumReadiness(input: {
  fullName?: unknown;
  full_name?: unknown;
  title?: unknown;
  headline?: unknown;
  experienceCount?: unknown;
  experience_count?: unknown;
  hasExperience?: unknown;
  has_experience?: unknown;
}) {
  const fullName = typeof input.fullName !== "undefined" ? input.fullName : input.full_name;
  const title = typeof input.title !== "undefined" ? input.title : input.headline;
  const experienceCount = resolveExperienceCount(input);
  const hasFullName = hasCompleteCandidateName(fullName);
  const hasTitle = hasProfessionalTitle(title);
  const hasExperience = experienceCount !== null ? experienceCount > 0 : false;

  return {
    hasFullName,
    hasTitle,
    hasExperience,
    isReady: hasFullName && hasTitle && hasExperience,
  };
}

export function resolveCandidateOnboardingCompleted(input: {
  onboardingCompleted?: unknown;
  onboarding_completed?: unknown;
  onboardingStep?: unknown;
  onboarding_step?: unknown;
  fullName?: unknown;
  full_name?: unknown;
  title?: unknown;
  headline?: unknown;
  experienceCount?: unknown;
  experience_count?: unknown;
  hasExperience?: unknown;
  has_experience?: unknown;
}) {
  const readiness = resolveCandidateMinimumReadiness(input);
  const readinessDataPresent =
    typeof input.fullName !== "undefined" ||
    typeof input.full_name !== "undefined" ||
    typeof input.title !== "undefined" ||
    typeof input.headline !== "undefined" ||
    typeof input.experienceCount !== "undefined" ||
    typeof input.experience_count !== "undefined" ||
    typeof input.hasExperience !== "undefined" ||
    typeof input.has_experience !== "undefined";

  if (readinessDataPresent) {
    return readiness.isReady;
  }

  if (typeof input.onboardingCompleted !== "undefined") {
    return coerceBoolean(input.onboardingCompleted);
  }
  if (typeof input.onboarding_completed !== "undefined" && coerceBoolean(input.onboarding_completed)) {
    return true;
  }
  const step = String(
    typeof input.onboardingStep !== "undefined" ? input.onboardingStep : input.onboarding_step || ""
  )
    .trim()
    .toLowerCase();
  return step === "finish" || step === "done" || step === "completed";
}
