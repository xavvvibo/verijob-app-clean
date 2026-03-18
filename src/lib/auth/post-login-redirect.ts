import { resolveSessionRole } from "@/lib/auth/session-role";
import { resolveCandidateOnboardingCompleted } from "@/lib/auth/onboarding-state";

export type AuthenticatedAppRole = "candidate" | "company" | "owner" | "admin";

type AuthRoutingInput = {
  role?: unknown;
  app_role?: unknown;
  onboardingCompleted?: unknown;
  onboarding_completed?: unknown;
  currentPath?: unknown;
  user?: any;
};

export function resolveAuthenticatedRouting(input: AuthRoutingInput) {
  const role = resolveSessionRole({
    profileRole: input.role,
    profileAppRole: input.app_role,
    user: input.user,
  }) as AuthenticatedAppRole;
  const onboardingCompleted =
    role === "candidate" ? resolveCandidateOnboardingCompleted(input) : true;
  const currentPath = String(input.currentPath || "").trim();

  let destination = "/candidate/overview";
  if (role === "owner" || role === "admin") destination = "/owner";
  else if (role === "company") destination = "/company";
  else if (!onboardingCompleted) destination = "/onboarding";

  return {
    role,
    onboardingCompleted,
    destination,
    shouldRedirect: !(currentPath && currentPath === destination),
  };
}

export function resolveAuthenticatedHomePath(input: AuthRoutingInput) {
  const routing = resolveAuthenticatedRouting(input);
  return routing.shouldRedirect ? routing.destination : null;
}

export function roleMatchesAllowed(role: AuthenticatedAppRole, allowed: ("candidate" | "company" | "owner")[]) {
  if (role === "admin") return allowed.includes("owner");
  return allowed.includes(role);
}
