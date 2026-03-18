export function resolveAuthenticatedHomePath(input: {
  role?: unknown;
  onboardingCompleted?: unknown;
}) {
  const role = String(input.role || "").toLowerCase();
  const onboardingCompleted = Boolean(input.onboardingCompleted);

  if (role === "owner" || role === "admin") return "/owner";
  if (role === "company") return "/company";
  if (role === "candidate" && !onboardingCompleted) return "/onboarding";
  if (role === "candidate") return "/candidate/overview";
  return "/dashboard";
}
