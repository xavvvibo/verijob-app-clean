import { resolveSessionRole } from "@/lib/auth/session-role";
import { resolveCandidateOnboardingCompleted } from "@/lib/auth/onboarding-state";

export function resolveAuthenticatedHomePath(input: {
  role?: unknown;
  app_role?: unknown;
  onboardingCompleted?: unknown;
  onboarding_completed?: unknown;
  currentPath?: unknown;
  user?: any;
}) {
  const role = resolveSessionRole({
    profileRole: input.role,
    profileAppRole: input.app_role,
    user: input.user,
  });
  const onboardingCompleted = resolveCandidateOnboardingCompleted(input);
  const currentPath = String(input.currentPath || "").trim();

  let destination: string | null = null;
  if (role === "owner" || role === "admin") destination = "/owner";
  else if (role === "company") destination = "/company";
  else if (role === "candidate" && !onboardingCompleted) destination = "/onboarding";
  else if (role === "candidate") destination = "/candidate/overview";

  if (!destination) return null;
  return currentPath && currentPath === destination ? null : destination;
}
