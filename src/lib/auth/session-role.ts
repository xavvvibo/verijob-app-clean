function normalizeRole(value: unknown) {
  const role = String(value || "").trim().toLowerCase();
  return role || "";
}

export function resolveSessionRole(input: {
  profileRole?: unknown;
  user?: any;
}) {
  const fromProfile = normalizeRole(input.profileRole);
  if (fromProfile) return fromProfile;

  const user = input.user || {};
  const appRole = normalizeRole(user?.app_metadata?.role);
  if (appRole) return appRole;

  const userRole = normalizeRole(user?.user_metadata?.role);
  if (userRole) return userRole;

  const claimRole = normalizeRole(user?.app_metadata?.claims?.role);
  if (claimRole) return claimRole;

  const appRoles = Array.isArray(user?.app_metadata?.roles)
    ? user.app_metadata.roles.map((item: unknown) => normalizeRole(item)).filter(Boolean)
    : [];
  if (appRoles.includes("owner")) return "owner";
  if (appRoles.includes("admin")) return "admin";

  if (user?.app_metadata?.is_owner === true || user?.user_metadata?.is_owner === true) return "owner";
  if (user?.app_metadata?.is_admin === true || user?.user_metadata?.is_admin === true) return "admin";

  return "";
}

export function isOwnerSessionRole(role: unknown) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin";
}
