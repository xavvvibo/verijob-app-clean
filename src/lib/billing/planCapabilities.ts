export type CandidateCommercialPlan = "free" | "starter" | "pro" | "proplus";
export type CompanyCommercialPlan = "free" | "access" | "hiring" | "team" | "enterprise";

export type CandidatePlanCapabilities = {
  plan: CandidateCommercialPlan;
  label: string;
  publicLabel: string;
  legacy: boolean;
  canShareByLink: boolean;
  canShareByQr: boolean;
  canDownloadVerifiedCv: boolean;
  activeWorkVerificationsLimit: number | null;
  activeAcademicVerificationsLimit: number | null;
  activeVerificationsLabel: string;
  summary: string;
};

export type CompanyPlanCapabilities = {
  plan: CompanyCommercialPlan;
  label: string;
  accessesIncludedMonthly: number | null;
  rrhhPanel: "Restringido" | "Operativo" | "Avanzado";
  includesSelection: boolean;
  summary: string;
  bullets: string[];
};

export function normalizeCandidateCommercialPlan(planRaw: unknown): CandidateCommercialPlan {
  const plan = String(planRaw || "").trim().toLowerCase();
  if (plan === "pro" || plan === "candidate_pro") return "pro";
  if (plan === "pro+") return "proplus";
  if (plan === "proplus" || plan === "candidate_proplus") return "proplus";
  if (plan === "starter" || plan === "starter legacy") return "starter";
  if (plan === "candidate_pro_monthly" || plan === "candidate_pro_yearly") return "pro";
  if (plan === "candidate_proplus_monthly" || plan === "candidate_proplus_yearly") return "proplus";
  if (plan === "candidate_starter_monthly" || plan === "candidate_starter_yearly") return "starter";
  return "free";
}

export function getCandidatePlanCapabilities(planRaw: unknown): CandidatePlanCapabilities {
  const plan = normalizeCandidateCommercialPlan(planRaw);

  if (plan === "proplus") {
    return {
      plan,
      label: "Pro+",
      publicLabel: "Pro+",
      legacy: false,
      canShareByLink: true,
      canShareByQr: true,
      canDownloadVerifiedCv: true,
      activeWorkVerificationsLimit: null,
      activeAcademicVerificationsLimit: null,
      activeVerificationsLabel: "Ilimitadas",
      summary: "Todo lo de Pro, más verificaciones activas ilimitadas y descarga de CV verificado.",
    };
  }

  if (plan === "pro") {
    return {
      plan,
      label: "Pro",
      publicLabel: "Pro",
      legacy: false,
      canShareByLink: true,
      canShareByQr: true,
      canDownloadVerifiedCv: false,
      activeWorkVerificationsLimit: 3,
      activeAcademicVerificationsLimit: 3,
      activeVerificationsLabel: "3 laborales + 3 académicas",
      summary: "Todo lo de Starter, más comparte tu perfil por QR y activa hasta 3 verificaciones laborales y 3 académicas.",
    };
  }

  if (plan === "starter") {
    return {
      plan,
      label: "Starter",
      publicLabel: "Starter",
      legacy: false,
      canShareByLink: true,
      canShareByQr: false,
      canDownloadVerifiedCv: false,
      activeWorkVerificationsLimit: 2,
      activeAcademicVerificationsLimit: 2,
      activeVerificationsLabel: "2 laborales + 2 académicas",
      summary: "Todo lo de Free, más hasta 2 verificaciones laborales y 2 académicas activas.",
    };
  }

  return {
    plan: "free",
    label: "Free",
    publicLabel: "Free",
    legacy: false,
    canShareByLink: true,
    canShareByQr: false,
    canDownloadVerifiedCv: false,
    activeWorkVerificationsLimit: 1,
    activeAcademicVerificationsLimit: 1,
    activeVerificationsLabel: "1 laboral + 1 académica",
    summary: "Crea tu perfil verificable y compártelo por link. Incluye hasta 1 verificación laboral y 1 académica activas.",
  };
}

export function normalizeCompanyCommercialPlan(planRaw: unknown): CompanyCommercialPlan {
  const plan = String(planRaw || "").trim().toLowerCase();
  if (plan === "team") return "team";
  if (plan === "hiring") return "hiring";
  if (plan === "access") return "access";
  if (plan === "enterprise") return "enterprise";
  if (plan.includes("company_team")) return "team";
  if (plan.includes("company_hiring")) return "hiring";
  if (plan.includes("company_access")) return "access";
  if (plan.includes("company_enterprise")) return "enterprise";
  return "free";
}

export function getCompanyPlanCapabilities(planRaw: unknown): CompanyPlanCapabilities {
  const plan = normalizeCompanyCommercialPlan(planRaw);

  if (plan === "team") {
    return {
      plan,
      label: "Team",
      accessesIncludedMonthly: 100,
      rrhhPanel: "Operativo",
      includesSelection: true,
      summary: "Todo lo de Hiring, más 100 accesos a perfiles al mes para equipos con mayor volumen.",
      bullets: [
        "Todo lo de Hiring, más 100 accesos a perfiles al mes",
        "Panel RRHH operativo",
        "Funcionalidades de selección",
      ],
    };
  }

  if (plan === "hiring") {
    return {
      plan,
      label: "Hiring",
      accessesIncludedMonthly: 50,
      rrhhPanel: "Operativo",
      includesSelection: true,
      summary: "Todo lo de Access, más 50 accesos a perfiles al mes y funcionalidades de selección.",
      bullets: [
        "Todo lo de Access, más 50 accesos a perfiles al mes",
        "Panel RRHH operativo",
        "Funcionalidades de selección",
      ],
    };
  }

  if (plan === "access") {
    return {
      plan,
      label: "Access",
      accessesIncludedMonthly: 15,
      rrhhPanel: "Operativo",
      includesSelection: false,
      summary: "Todo lo de Free, más 15 accesos a perfiles al mes y panel RRHH operativo.",
      bullets: [
        "Todo lo de Free, más 15 accesos a perfiles al mes",
        "Panel RRHH operativo",
        "Compra puntual de accesos adicional",
      ],
    };
  }

  if (plan === "enterprise") {
    return {
      plan,
      label: "Enterprise",
      accessesIncludedMonthly: null,
      rrhhPanel: "Avanzado",
      includesSelection: true,
      summary: "Plan avanzado con capacidad y operación personalizada.",
      bullets: [
        "Capacidad personalizada",
        "Operación RRHH avanzada",
        "Activación comercial específica",
      ],
    };
  }

  return {
    plan: "free",
    label: "Free",
    accessesIncludedMonthly: 2,
    rrhhPanel: "Restringido",
    includesSelection: false,
    summary: "2 accesos a perfiles al mes y panel RRHH restringido.",
    bullets: [
      "2 accesos a perfiles al mes",
      "Panel RRHH restringido",
      "Compra puntual de accesos adicional",
    ],
  };
}

export function visibleCandidatePlanName(planRaw: unknown) {
  return getCandidatePlanCapabilities(planRaw).publicLabel;
}

export function visibleCompanyPlanName(planRaw: unknown) {
  return getCompanyPlanCapabilities(planRaw).label;
}
