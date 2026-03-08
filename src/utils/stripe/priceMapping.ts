export type StripePlanKey =
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
  | "company_single_profile"
  | "company_pack5_profiles";

type StripeMode = "subscription" | "payment";

const PLAN_TO_ENV: Record<StripePlanKey, string> = {
  candidate_starter_monthly: "STRIPE_PRICE_CANDIDATE_STARTER_MONTHLY",
  candidate_starter_yearly: "STRIPE_PRICE_CANDIDATE_STARTER_YEARLY",
  candidate_pro_monthly: "STRIPE_PRICE_CANDIDATE_PRO_MONTHLY",
  candidate_pro_yearly: "STRIPE_PRICE_CANDIDATE_PRO_YEARLY",
  candidate_proplus_monthly: "STRIPE_PRICE_CANDIDATE_PROPLUS_MONTHLY",
  candidate_proplus_yearly: "STRIPE_PRICE_CANDIDATE_PROPLUS_YEARLY",
  company_access_monthly: "STRIPE_PRICE_COMPANY_ACCESS_MONTHLY",
  company_access_yearly: "STRIPE_PRICE_COMPANY_ACCESS_YEARLY",
  company_hiring_monthly: "STRIPE_PRICE_COMPANY_HIRING_MONTHLY",
  company_hiring_yearly: "STRIPE_PRICE_COMPANY_HIRING_YEARLY",
  company_team_monthly: "STRIPE_PRICE_COMPANY_TEAM_MONTHLY",
  company_team_yearly: "STRIPE_PRICE_COMPANY_TEAM_YEARLY",
  company_single_profile: "STRIPE_PRICE_COMPANY_SINGLE_PROFILE",
  company_pack5_profiles: "STRIPE_PRICE_COMPANY_PACK5_PROFILES",
};

const PLAN_TO_ENV_LEGACY_ID: Partial<Record<StripePlanKey, string>> = {
  candidate_starter_monthly: "STRIPE_PRICE_ID_CANDIDATE_STARTER_MONTHLY",
  candidate_starter_yearly: "STRIPE_PRICE_ID_CANDIDATE_STARTER_YEARLY",
  candidate_pro_monthly: "STRIPE_PRICE_ID_CANDIDATE_PRO_MONTHLY",
  candidate_pro_yearly: "STRIPE_PRICE_ID_CANDIDATE_PRO_YEARLY",
  candidate_proplus_monthly: "STRIPE_PRICE_ID_CANDIDATE_PROPLUS_MONTHLY",
  candidate_proplus_yearly: "STRIPE_PRICE_ID_CANDIDATE_PROPLUS_YEARLY",
  company_access_monthly: "STRIPE_PRICE_ID_COMPANY_ACCESS_MONTHLY",
  company_access_yearly: "STRIPE_PRICE_ID_COMPANY_ACCESS_YEARLY",
  company_hiring_monthly: "STRIPE_PRICE_ID_COMPANY_HIRING_MONTHLY",
  company_hiring_yearly: "STRIPE_PRICE_ID_COMPANY_HIRING_YEARLY",
  company_team_monthly: "STRIPE_PRICE_ID_COMPANY_TEAM_MONTHLY",
  company_team_yearly: "STRIPE_PRICE_ID_COMPANY_TEAM_YEARLY",
  company_single_profile: "STRIPE_PRICE_ID_COMPANY_SINGLE_CV",
  company_pack5_profiles: "STRIPE_PRICE_ID_COMPANY_PACK_5",
};

function firstEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim().length > 0) return String(value).trim();
  }
  return null;
}

export function normalizePlanKey(raw: unknown): StripePlanKey {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "company_access_monthly";

  if (value === "company_enterprise" || value.startsWith("company_enterprise_")) {
    throw new Error("enterprise_contact_only");
  }

  if (value in PLAN_TO_ENV) return value as StripePlanKey;

  if (value === "candidate_starter") return "candidate_starter_monthly";
  if (value === "candidate_pro") return "candidate_pro_monthly";
  if (value === "candidate_proplus") return "candidate_proplus_monthly";

  if (value === "company_access") return "company_access_monthly";
  if (value === "company_hiring") return "company_hiring_monthly";
  if (value === "company_team") return "company_team_monthly";

  if (value === "company_single_cv" || value === "company_single") return "company_single_profile";
  if (value === "company_pack_5" || value === "company_pack_5_profiles") return "company_pack5_profiles";

  throw new Error("unsupported_plan");
}

export function resolvePriceForPlan(planKeyRaw: unknown): {
  planKey: StripePlanKey;
  priceId: string;
  mode: StripeMode;
  envName: string;
} {
  const planKey = normalizePlanKey(planKeyRaw);
  const envName = PLAN_TO_ENV[planKey];
  const legacyEnvName = PLAN_TO_ENV_LEGACY_ID[planKey];
  const priceId = firstEnv(envName, ...(legacyEnvName ? [legacyEnvName] : []));

  if (!priceId) {
    throw new Error(`missing_env_${legacyEnvName ? `${envName}_or_${legacyEnvName}` : envName}`);
  }

  const mode: StripeMode =
    planKey === "company_single_profile" || planKey === "company_pack5_profiles"
      ? "payment"
      : "subscription";

  return { planKey, priceId, mode, envName };
}

export function resolvePlanFromPriceId(priceIdRaw: unknown): {
  planKey: StripePlanKey;
  mode: StripeMode;
} | null {
  const priceId = String(priceIdRaw || "").trim();
  if (!priceId) return null;

  const entries = Object.entries(PLAN_TO_ENV) as Array<[StripePlanKey, string]>;
  for (const [planKey, envName] of entries) {
    const legacyEnvName = PLAN_TO_ENV_LEGACY_ID[planKey];
    const mapped = firstEnv(envName, ...(legacyEnvName ? [legacyEnvName] : []));
    if (mapped && mapped === priceId) {
      const mode: StripeMode =
        planKey === "company_single_profile" || planKey === "company_pack5_profiles"
          ? "payment"
          : "subscription";
      return { planKey, mode };
    }
  }
  return null;
}
