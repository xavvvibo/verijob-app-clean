import "server-only";
import { createHmac } from "crypto";

export type IdentityType = "dni" | "nif" | "passport";

const ALLOWED_IDENTITY_TYPES = new Set<IdentityType>(["dni", "nif", "passport"]);

function compactIdentity(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function normalizeIdentityType(value: unknown): IdentityType | null {
  const normalized = String(value || "").trim().toLowerCase() as IdentityType;
  return ALLOWED_IDENTITY_TYPES.has(normalized) ? normalized : null;
}

export function normalizeIdentityValue(value: unknown) {
  const compact = compactIdentity(String(value || ""));
  return compact.length >= 5 ? compact : null;
}

export function maskIdentityValue(value: string) {
  const compact = compactIdentity(value);
  if (!compact) return null;
  if (compact.length <= 4) return `${compact.charAt(0)}***`;
  const head = compact.slice(0, Math.min(2, Math.max(1, compact.length - 4)));
  const tail = compact.slice(-2);
  return `${head}${"*".repeat(Math.max(compact.length - head.length - tail.length, 3))}${tail}`;
}

export function hashIdentityValue(value: string) {
  const secret = String(process.env.IDENTITY_HASH_PEPPER || "").trim();
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

