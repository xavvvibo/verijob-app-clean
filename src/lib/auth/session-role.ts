function normalizeRole(value: unknown) {
  const role = String(value || "").trim().toLowerCase();
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
  user?: any;
}) {
  const user = input.user || {};
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
  if (roles.includes("candidate")) return "candidate";

  const fallbackProfileRole = knownRole(input.profileRole);
  if (fallbackProfileRole) return fallbackProfileRole;

  return prioritizedCandidates.length > 0 ? "candidate" : "";
}

export function isOwnerSessionRole(role: unknown) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin";
}
