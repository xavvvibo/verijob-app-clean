export async function resolveCompanyProfileAccessCredits(args: {
  service: any;
  userId: string;
  companyId: string;
}) {
  const [grantsRes, consumptionsRes] = await Promise.all([
    args.service
      .from("credit_grants")
      .select("credits,metadata,is_active")
      .eq("user_id", args.userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    args.service
      .from("profile_view_consumptions")
      .select("credits_spent")
      .eq("company_id", args.companyId)
      .eq("viewer_user_id", args.userId),
  ]);

  const grants = Array.isArray(grantsRes.data) ? grantsRes.data : [];
  const consumptions = Array.isArray(consumptionsRes.data) ? consumptionsRes.data : [];

  const granted = grants.reduce((acc: number, row: any) => {
    const metadataCompanyId = String(row?.metadata?.company_id || "").trim();
    if (metadataCompanyId && metadataCompanyId !== args.companyId) return acc;
    return acc + Number(row?.credits || 0);
  }, 0);

  const consumed = consumptions.reduce((acc: number, row: any) => acc + Number(row?.credits_spent || 0), 0);

  return {
    available: Math.max(0, granted - consumed),
    granted,
    consumed,
    source_available: !grantsRes.error && !consumptionsRes.error,
  };
}
