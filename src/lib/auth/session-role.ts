function normalizeRole(value: unknown) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "owner" || role === "admin" || role === "company" || role === "candidate") return role;
  if (role === "empresa") return "company";
  if (role === "candidato") return "candidate";
  return "";
}

export function resolveSessionRole(input: {
  profileRole?: unknown;
  profileAppRole?: unknown;
  user?: any;
}) {
  const user = input.user || {};
  const roles = [
    normalizeRole(input.profileAppRole),
    normalizeRole(user?.app_metadata?.role),
    normalizeRole(user?.user_metadata?.role),
    normalizeRole(user?.app_metadata?.claims?.role),
    ...(Array.isArray(user?.app_metadata?.roles)
      ? user.app_metadata.roles.map((item: unknown) => normalizeRole(item)).filter(Boolean)
      : []),
    normalizeRole(input.profileRole),
    user?.app_metadata?.is_admin === true || user?.user_metadata?.is_admin === true ? "admin" : "",
    user?.app_metadata?.is_owner === true || user?.user_metadata?.is_owner === true ? "owner" : "",
  ].filter(Boolean);

  if (roles.includes("admin")) return "admin";
  if (roles.includes("owner")) return "owner";
  if (roles.includes("company")) return "company";
  if (roles.includes("candidate")) return "candidate";
  return "";
}

export function isOwnerSessionRole(role: unknown) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin";
}
