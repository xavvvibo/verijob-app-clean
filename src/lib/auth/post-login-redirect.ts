export function resolveAuthenticatedHomePath(input: {
  role?: unknown;
  onboardingCompleted?: unknown;
  onboarding_completed?: unknown;
  currentPath?: unknown;
}) {
  const role = String(input.role || "").toLowerCase();
  const onboardingCompleted =
    typeof input.onboardingCompleted !== "undefined"
      ? Boolean(input.onboardingCompleted)
      : Boolean(input.onboarding_completed);
  const currentPath = String(input.currentPath || "").trim();

  let destination = "/dashboard";
  if (role === "owner" || role === "admin") destination = "/owner";
  else if (role === "company") destination = "/company";
  else if (role === "candidate" && !onboardingCompleted) destination = "/onboarding";
  else if (role === "candidate") destination = "/candidate/overview";

  return currentPath && currentPath === destination ? null : destination;
}
