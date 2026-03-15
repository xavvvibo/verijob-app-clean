import { normalizePlanKey, type StripePlanKey } from "@/utils/stripe/priceMapping";

export type ManagedSubscriptionPlanKey =
  | "free"
  | Extract<
      StripePlanKey,
      | "candidate_starter_monthly"
      | "candidate_starter_yearly"
      | "candidate_pro_monthly"
      | "candidate_pro_yearly"
      | "candidate_proplus_monthly"
      | "candidate_proplus_yearly"
      | "company_access_monthly"
      | "company_access_yearly"
      | "company_hiring_monthly"
      | "company_hiring_yearly"
      | "company_team_monthly"
      | "company_team_yearly"
    >;

export type ManagedPlanRole = "candidate" | "company";

export type ManagedPlanOption = {
  key: ManagedSubscriptionPlanKey;
  label: string;
  role: ManagedPlanRole | "all";
  amountCents: number;
};

export const MANAGED_SUBSCRIPTION_PLANS: readonly ManagedPlanOption[] = [
  { key: "free", label: "Free", role: "all", amountCents: 0 },
  { key: "candidate_starter_monthly", label: "Starter legacy mensual", role: "candidate", amountCents: 299 },
  { key: "candidate_starter_yearly", label: "Starter legacy anual", role: "candidate", amountCents: 2990 },
  { key: "candidate_pro_monthly", label: "Pro mensual", role: "candidate", amountCents: 499 },
  { key: "candidate_pro_yearly", label: "Pro anual", role: "candidate", amountCents: 4990 },
  { key: "candidate_proplus_monthly", label: "Pro+ mensual", role: "candidate", amountCents: 999 },
  { key: "candidate_proplus_yearly", label: "Pro+ anual", role: "candidate", amountCents: 9990 },
  { key: "company_access_monthly", label: "Access mensual", role: "company", amountCents: 4900 },
  { key: "company_access_yearly", label: "Access anual", role: "company", amountCents: 49000 },
  { key: "company_hiring_monthly", label: "Hiring mensual", role: "company", amountCents: 9900 },
  { key: "company_hiring_yearly", label: "Hiring anual", role: "company", amountCents: 99000 },
  { key: "company_team_monthly", label: "Team mensual", role: "company", amountCents: 19900 },
  { key: "company_team_yearly", label: "Team anual", role: "company", amountCents: 199000 },
] as const;

const MANAGED_PLAN_MAP = new Map(MANAGED_SUBSCRIPTION_PLANS.map((plan) => [plan.key, plan]));

export function isManagedSubscriptionPlanKey(raw: unknown): raw is ManagedSubscriptionPlanKey {
  return MANAGED_PLAN_MAP.has(String(raw || "").trim().toLowerCase() as ManagedSubscriptionPlanKey);
}

export function normalizeManagedSubscriptionPlanKey(raw: unknown): ManagedSubscriptionPlanKey | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "free" || value === "company_free") return "free";
  if (isManagedSubscriptionPlanKey(value)) return value;

  try {
    const normalized = normalizePlanKey(value);
    if (normalized === "company_single_profile" || normalized === "company_pack5_profiles") return null;
    return isManagedSubscriptionPlanKey(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function getManagedSubscriptionPlansForRole(role: ManagedPlanRole): ManagedPlanOption[] {
  return MANAGED_SUBSCRIPTION_PLANS.filter((plan) => plan.role === "all" || plan.role === role);
}

export function estimateManagedPlanAmountCents(planKey: ManagedSubscriptionPlanKey): number {
  return MANAGED_PLAN_MAP.get(planKey)?.amountCents ?? 0;
}

export function managedPlanLabel(raw: unknown): string {
  const normalized = normalizeManagedSubscriptionPlanKey(raw);
  if (!normalized) return String(raw || "free").trim() || "free";
  return MANAGED_PLAN_MAP.get(normalized)?.label || normalized;
}
