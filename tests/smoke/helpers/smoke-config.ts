export type SmokeActorConfig = {
  email: string;
  otp?: string;
  authMode: "signup" | "login";
};

function readActor(prefix: "COMPANY" | "CANDIDATE"): SmokeActorConfig {
  const email = String(process.env[`SMOKE_${prefix}_EMAIL`] || "").trim();
  const otp = String(process.env[`SMOKE_${prefix}_OTP`] || "").trim() || undefined;
  const authModeRaw = String(process.env[`SMOKE_${prefix}_AUTH_MODE`] || "signup").trim().toLowerCase();
  const authMode = authModeRaw === "login" ? "login" : "signup";
  return { email, otp, authMode };
}

export const smokeConfig = {
  execution: {
    candidateFirstSpecs: ["tests/smoke/smoke-candidate.spec.ts", "tests/smoke/smoke-public-profile.spec.ts"],
    companySpecs: ["tests/smoke/smoke-company.spec.ts"],
  },
  company: readActor("COMPANY"),
  candidate: readActor("CANDIDATE"),
  companyProfile: {
    legalName: String(process.env.SMOKE_COMPANY_LEGAL_NAME || "Verijob Smoke QA S.L.").trim(),
    tradeName: String(process.env.SMOKE_COMPANY_TRADE_NAME || "Verijob Smoke QA").trim(),
    taxId: String(process.env.SMOKE_COMPANY_TAX_ID || "B12345678").trim(),
    contactEmail: String(process.env.SMOKE_COMPANY_CONTACT_EMAIL || process.env.SMOKE_COMPANY_EMAIL || "").trim(),
    contactPhone: String(process.env.SMOKE_COMPANY_CONTACT_PHONE || "600123123").trim(),
    contactPersonName: String(process.env.SMOKE_COMPANY_CONTACT_NAME || "QA Smoke").trim(),
    contactPersonRole: String(process.env.SMOKE_COMPANY_CONTACT_ROLE || "People Ops").trim(),
    sector: String(process.env.SMOKE_COMPANY_SECTOR || "Hostelería").trim(),
    companyType: String(process.env.SMOKE_COMPANY_TYPE || "PYME").trim(),
    businessModel: String(process.env.SMOKE_COMPANY_BUSINESS_MODEL || "B2B").trim(),
    marketSegment: String(process.env.SMOKE_COMPANY_MARKET_SEGMENT || "Nacional").trim(),
    operatingAddress: String(process.env.SMOKE_COMPANY_OPERATING_ADDRESS || "Calle Smoke 123, Madrid").trim(),
  },
  candidateExperience: {
    roleTitle: String(process.env.SMOKE_CANDIDATE_ROLE || "Camarero").trim(),
    companyName: String(process.env.SMOKE_CANDIDATE_COMPANY || "Smoke Bar").trim(),
    startDate: String(process.env.SMOKE_CANDIDATE_START_DATE || "2023-01").trim(),
    endDate: String(process.env.SMOKE_CANDIDATE_END_DATE || "2024-06").trim(),
    description: String(process.env.SMOKE_CANDIDATE_DESCRIPTION || "Atención en sala, caja y apoyo operativo.").trim(),
  },
  candidateVerification: {
    verifierEmail: String(process.env.SMOKE_CANDIDATE_VERIFIER_EMAIL || "rrhh@empresa.com").trim(),
  },
};

export function requireSmokeEmail(email: string, label: string) {
  if (!email) {
    throw new Error(`Falta ${label}. Define la variable de entorno correspondiente antes de ejecutar el smoke.`);
  }
}
