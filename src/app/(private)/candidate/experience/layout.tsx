import { requireCandidateMinimumReadiness } from "../requireCandidateMinimumReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CandidateExperienceLayout({ children }: { children: React.ReactNode }) {
  await requireCandidateMinimumReadiness("/candidate/experience", {
    requireFullReadiness: false,
    missingNameRedirect: "/onboarding/experience?blocked=1&reason=missing_name",
  });
  return <>{children}</>;
}
