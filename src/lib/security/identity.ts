import "server-only";
import { createHmac } from "crypto";

export type IdentityType = "dni" | "nie" | "passport";

const ALLOWED_IDENTITY_TYPES = new Set<IdentityType>(["dni", "nie", "passport"]);

function compactIdentity(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function normalizeIdentityType(value: unknown): IdentityType | null {
  const raw = String(value || "").trim().toLowerCase();
  const normalized = (raw === "nif" ? "nie" : raw) as IdentityType;
  return ALLOWED_IDENTITY_TYPES.has(normalized) ? normalized : null;
}

export function normalizeIdentityValue(value: unknown) {
  const compact = compactIdentity(String(value || ""));
  return compact.length >= 5 ? compact : null;
}

export function maskIdentityValue(value: string) {
  const compact = compactIdentity(value);
  if (!compact) return null;
  if (compact.length <= 3) return `${"*".repeat(Math.max(compact.length - 1, 1))}${compact.slice(-1)}`;
  const tail = compact.slice(-3);
  return `${"*".repeat(Math.max(compact.length - tail.length, 3))}${tail}`;
}

export function hashIdentityValue(value: string) {
  const secret = String(
    process.env.IDENTITY_HASH_PEPPER ||
    process.env.INTERNAL_HASH_PEPPER ||
    process.env.APP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  if (!secret) {
    throw new Error("identity_hash_pepper_missing");
  }
  return createHmac("sha256", secret).update(compactIdentity(value)).digest("hex");
}

export function buildIdentityRecord(input: { type: unknown; value: unknown }) {
  const identityType = normalizeIdentityType(input.type);
  const normalizedValue = normalizeIdentityValue(input.value);
  if (!identityType || !normalizedValue) {
    return {
      identityType: null,
      identityMasked: null,
      identityHash: null,
    };
  }
  return {
    identityType,
    identityMasked: maskIdentityValue(normalizedValue),
    identityHash: hashIdentityValue(normalizedValue),
  };
}
