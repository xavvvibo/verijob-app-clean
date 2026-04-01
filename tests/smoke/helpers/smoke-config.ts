import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { BrowserContext } from "@playwright/test";

export type SmokeActorKind = "candidate" | "company" | "owner";
export type PrivateActorLabel = SmokeActorKind;

export type SmokeActorConfig = {
  email: string;
  otp?: string;
  authMode: "signup" | "login";
  storageStatePath: string;
  useStorageState: boolean;
};

function deriveEmailDomain(email: string) {
  const normalized = String(email || "").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at >= 0 ? normalized.slice(at + 1) : "";
}

function resolveStorageStatePath(rawPath: string, actor: SmokeActorKind) {
  const fallback = path.resolve(process.cwd(), "playwright", ".auth", `${actor}-live.json`);
  const normalized = String(rawPath || "").trim();
  if (!normalized) return fallback;
  return path.isAbsolute(normalized) ? normalized : path.resolve(process.cwd(), normalized);
}

function readActor(
  prefix: "COMPANY" | "CANDIDATE" | "OWNER",
  options: {
    actor: SmokeActorKind;
    defaultEmail?: string;
    defaultAuthMode?: "signup" | "login";
  },
): SmokeActorConfig {
  const email = String(process.env[`SMOKE_${prefix}_EMAIL`] || options.defaultEmail || "").trim();
  const otp = String(process.env[`SMOKE_${prefix}_OTP`] || "").trim() || undefined;
  const authModeRaw = String(process.env[`SMOKE_${prefix}_AUTH_MODE`] || options.defaultAuthMode || "login")
    .trim()
    .toLowerCase();
  const authMode = authModeRaw === "login" ? "login" : "signup";
  const storageStatePath = resolveStorageStatePath(
    String(process.env[`SMOKE_${prefix}_STORAGE_STATE`] || ""),
    options.actor,
  );
  const useStorageState = String(process.env[`SMOKE_${prefix}_USE_STORAGE_STATE`] || "1").trim() !== "0";
  return { email, otp, authMode, storageStatePath, useStorageState };
}

export const smokeConfig = {
  execution: {
    candidateFirstSpecs: ["tests/smoke/smoke-candidate.spec.ts", "tests/smoke/smoke-public-profile.spec.ts"],
    companySpecs: ["tests/smoke/smoke-company.spec.ts"],
    betaGateSpecs: ["tests/smoke/smoke-beta-journey.spec.ts"],
  },
  company: readActor("COMPANY", {
    actor: "company",
    defaultEmail: String(process.env.COMPANY_EMAIL || "empresa-test@califystaff.com").trim(),
    defaultAuthMode: "login",
  }),
  candidate: readActor("CANDIDATE", {
    actor: "candidate",
    defaultEmail: String(process.env.CANDIDATE_EMAIL || "candidato-test@califystaff.com").trim(),
    defaultAuthMode: "login",
  }),
  owner: readActor("OWNER", {
    actor: "owner",
    defaultEmail: String(process.env.OWNER_EMAIL || "javier@verijob.es").trim(),
    defaultAuthMode: "login",
  }),
  companyProfile: {
    legalName: String(process.env.SMOKE_COMPANY_LEGAL_NAME || "Verijob Smoke QA S.L.").trim(),
    tradeName: String(process.env.SMOKE_COMPANY_TRADE_NAME || "Verijob Smoke QA").trim(),
    taxId: String(process.env.SMOKE_COMPANY_TAX_ID || "B12345678").trim(),
    contactEmail: String(
      process.env.SMOKE_COMPANY_CONTACT_EMAIL ||
        process.env.SMOKE_COMPANY_EMAIL ||
        process.env.COMPANY_EMAIL ||
        "empresa-test@califystaff.com",
    ).trim(),
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
    verifierEmail: String(
      process.env.SMOKE_CANDIDATE_VERIFIER_EMAIL ||
        `rrhh@${deriveEmailDomain(
          String(process.env.SMOKE_COMPANY_CONTACT_EMAIL || process.env.SMOKE_COMPANY_EMAIL || "empresa.com"),
        ) || "empresa.com"}`,
    ).trim(),
  },
};

export function requireSmokeEmail(email: string, label: string) {
  if (!email) {
    throw new Error(`Falta ${label}. Define la variable de entorno correspondiente antes de ejecutar el smoke.`);
  }
}

export function actorConfig(actor: PrivateActorLabel): SmokeActorConfig {
  return smokeConfig[actor];
}

export function isAuthenticatedUrl(url: string, actor: PrivateActorLabel): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    if (/\/login|\/signup/i.test(pathname)) return false;

    if (actor === "candidate") {
      return /^\/candidate(\/|$)/.test(pathname) || /^\/onboarding(\/|$)/.test(pathname);
    }

    if (actor === "company") {
      return /^\/company(\/|$)/.test(pathname) || /^\/onboarding\/company(\/|$)/.test(pathname);
    }

    return /^\/owner(\/|$)/.test(pathname);
  } catch {
    return false;
  }
}

export async function persistStorageState(context: BrowserContext, storageStatePath: string) {
  const dir = path.dirname(storageStatePath);
  await mkdir(dir, { recursive: true });
  await context.storageState({ path: storageStatePath });
}
