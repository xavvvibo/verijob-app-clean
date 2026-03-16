import { getCompanyPlanCapabilities } from "@/lib/billing/planCapabilities";
import { readEffectiveCompanySubscriptionState } from "@/lib/billing/effectiveSubscription";

export async function resolveCompanyProfileAccessCredits(args: {
  service: any;
  userId: string;
  companyId: string;
}) {
  const [grantsRes, consumptionsRes, subscriptionState] = await Promise.all([
    args.service
      .from("credit_grants")
      .select("credits,metadata,is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    args.service
      .from("profile_view_consumptions")
      .select("credits_spent")
      .eq("company_id", args.companyId),
    readEffectiveCompanySubscriptionState(args.service, {
      userId: args.userId,
      companyId: args.companyId,
    }),
  ]);

  const grants = Array.isArray(grantsRes.data) ? grantsRes.data : [];
  const consumptions = Array.isArray(consumptionsRes.data) ? consumptionsRes.data : [];
  const capabilities = getCompanyPlanCapabilities(subscriptionState.plan);
  const includedMonthly = Number(capabilities.accessesIncludedMonthly ?? 0);

  const granted = grants.reduce((acc: number, row: any) => {
    const metadataCompanyId = String(row?.metadata?.company_id || "").trim();
    if (!metadataCompanyId || metadataCompanyId !== args.companyId) return acc;
    return acc + Number(row?.credits || 0);
  }, 0);

  const consumed = consumptions.reduce((acc: number, row: any) => acc + Number(row?.credits_spent || 0), 0);

  return {
    available: Math.max(0, includedMonthly + granted - consumed),
    included_monthly: capabilities.accessesIncludedMonthly,
    plan: subscriptionState.plan,
    granted,
    consumed,
    source_available: !grantsRes.error && !consumptionsRes.error,
  };
}
