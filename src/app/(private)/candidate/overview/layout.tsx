import { requireCandidateMinimumReadiness } from "../requireCandidateMinimumReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CandidateOverviewLayout({ children }: { children: React.ReactNode }) {
  await requireCandidateMinimumReadiness("/candidate/overview");
  return <>{children}</>;
}
