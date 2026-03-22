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
  onboardingStep?: unknown;
  onboarding_step?: unknown;
}) {
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
