function coerceBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return Boolean(value);
}

export function resolveCandidateOnboardingCompleted(input: {
  onboardingCompleted?: unknown;
  onboarding_completed?: unknown;
}) {
  if (typeof input.onboardingCompleted !== "undefined") {
    return coerceBoolean(input.onboardingCompleted);
  }
  return coerceBoolean(input.onboarding_completed);
}
