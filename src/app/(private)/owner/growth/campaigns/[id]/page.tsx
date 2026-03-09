export const dynamic = "force-dynamic";

import CampaignDetailClient from "./CampaignDetailClient";

export default async function OwnerGrowthCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignDetailClient campaignId={id} />;
}
