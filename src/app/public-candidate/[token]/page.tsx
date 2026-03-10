import { redirect } from "next/navigation";

type Ctx = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

export default async function LegacyPublicCandidatePage({ params }: Ctx) {
  const { token } = await params;
  redirect(`/p/${encodeURIComponent(token)}`);
}
