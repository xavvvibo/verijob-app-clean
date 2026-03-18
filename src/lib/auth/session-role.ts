function normalizeRole(value: unknown) {
  const role = String(value || "").trim().toLowerCase();
  if (!role) return "";
  if (role === "true" || role === "1") return "true";
  if (role === "false" || role === "0") return "false";
  if (role.includes("superadmin") || role.includes("platform_admin") || role.includes("internal_admin")) return "admin";
  if (role.includes("owner")) return "owner";
  if (role.includes("company") || role.includes("empresa")) return "company";
  if (role === "reviewer" || role === "recruiter") return "company";
  if (role === "empresa") return "company";
  if (role === "candidato") return "candidate";
  return role || "";
}

function knownRole(value: unknown) {
  const role = normalizeRole(value);
  if (role === "owner" || role === "admin" || role === "company" || role === "candidate") return role;
  return "";
}

export function resolveSessionRole(input: {
  profileRole?: unknown;
  profileAppRole?: unknown;
  activeCompanyId?: unknown;
  user?: any;
}) {
  const user = input.user || {};
  const hasActiveCompany = Boolean(String(input.activeCompanyId || "").trim());
  const prioritizedCandidates = [
    input.profileAppRole,
    user?.app_metadata?.role,
    user?.user_metadata?.role,
    user?.app_metadata?.claims?.role,
    ...(Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []),
    user?.app_metadata?.is_admin === true || user?.user_metadata?.is_admin === true ? "admin" : "",
    user?.app_metadata?.is_owner === true || user?.user_metadata?.is_owner === true ? "owner" : "",
    input.profileRole,
  ].filter(Boolean);

  const roles = prioritizedCandidates.map((value) => knownRole(value)).filter(Boolean);

  if (roles.includes("admin")) return "admin";
  if (roles.includes("owner")) return "owner";
  if (roles.includes("company")) return "company";
  if (hasActiveCompany) return "company";
  if (roles.includes("candidate")) return "candidate";

  const fallbackProfileRole = knownRole(input.profileRole);
  if (fallbackProfileRole) return fallbackProfileRole;

  return prioritizedCandidates.length > 0 ? "candidate" : "";
}

export function isOwnerSessionRole(role: unknown) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin";
}
