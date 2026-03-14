import { managedPlanLabel } from "@/lib/billing/managedPlans";

export type EffectiveSubscriptionState = {
  plan: string;
  status: string;
  current_period_end: string | null;
  metadata: Record<string, any>;
  source: "subscription" | "override" | "none";
  subscription: any | null;
  override: any | null;
};

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function isActiveOverride(row: any, nowIso: string) {
  if (!row || row.is_active !== true) return false;
  const startsAt = String(row.starts_at || "").trim();
  const expiresAt = String(row.expires_at || "").trim();
  if (startsAt && Date.parse(startsAt) > Date.parse(nowIso)) return false;
  if (expiresAt && Date.parse(expiresAt) <= Date.parse(nowIso)) return false;
  return true;
}

export async function readEffectiveSubscriptionState(admin: any, userId: string): Promise<EffectiveSubscriptionState> {
  const nowIso = new Date().toISOString();
  const [subscriptionRes, overridesRes] = await Promise.all([
    admin
      .from("subscriptions")
      .select("id,plan,status,current_period_end,cancel_at_period_end,metadata,created_at,updated_at,stripe_customer_id,stripe_subscription_id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("plan_overrides")
      .select("id,plan_key,source_type,source_id,starts_at,expires_at,is_active,metadata,created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const subscription = subscriptionRes.data || null;
  const override =
    (Array.isArray(overridesRes.data) ? overridesRes.data : []).find((row: any) => isActiveOverride(row, nowIso)) || null;

  if (override) {
    const overrideMetadata = {
      ...asObject(override.metadata),
      owner_override: {
        type: String(override.source_type || "manual_override"),
        source_id: override.source_id || null,
        at: override.created_at || null,
        reason: asObject(override.metadata).reason || null,
      },
    };
    return {
      plan: String(override.plan_key || "free"),
      status: "active",
      current_period_end: override.expires_at ? String(override.expires_at) : null,
      metadata: overrideMetadata,
      source: "override",
      subscription,
      override,
    };
  }

  if (subscription) {
    return {
      plan: String(subscription.plan || "free"),
      status: String(subscription.status || "free"),
      current_period_end: subscription.current_period_end ? String(subscription.current_period_end) : null,
      metadata: asObject(subscription.metadata),
      source: "subscription",
      subscription,
      override: null,
    };
  }

  return {
    plan: "free",
    status: "free",
    current_period_end: null,
    metadata: {},
    source: "none",
    subscription: null,
    override: null,
  };
}

export function effectivePlanDisplay(state: EffectiveSubscriptionState) {
  return {
    planLabel: managedPlanLabel(state.plan),
    isManualOverride: state.source === "override",
  };
}
