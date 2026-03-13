import CompanyCandidateImportAcceptClient from "./CompanyCandidateImportAcceptClient";

export const dynamic = "force-dynamic";

export default async function CompanyCandidateImportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CompanyCandidateImportAcceptClient token={token} />;
}
