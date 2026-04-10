import { CandidateExperienceContent } from "../../candidate/experience/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OnboardingCandidateExperiencePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CandidateExperienceContent searchParams={searchParams} onboardingMode={true} onboardingEntry="experience" />;
}
