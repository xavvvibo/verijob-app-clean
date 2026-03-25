export type PublicCompanyViewerAccess = {
  is_authenticated_company?: boolean;
  available_accesses?: number;
  already_unlocked?: boolean;
  unlocked_at?: string | null;
  unlocked_until?: string | null;
} | null;

export function resolvePublicCompanyAccessCta(args: {
  token?: string | null;
  companyViewer?: PublicCompanyViewerAccess;
}) {
  const token = String(args.token || "").trim();
  const companyIsAuthenticated = Boolean(args.companyViewer?.is_authenticated_company && token);

  return {
    companyIsAuthenticated,
    companyPreviewHref: token ? `/company/candidate/${token}` : "/company/candidates",
    companyFullHref: token ? `/company/candidate/${token}?view=full` : "/company/candidates",
    companyUnlockHref: token ? `/api/company/candidate/${token}/unlock` : undefined,
    loginUrl: `/login?mode=company&next=${encodeURIComponent(token ? `/company/candidate/${token}` : "/company/candidates")}`,
    signupUrl: `/signup?mode=company&next=${encodeURIComponent(token ? `/company/candidate/${token}` : "/company/candidates")}`,
  };
}
