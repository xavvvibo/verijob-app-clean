import { resolveCompanyProfileAccessCredits } from "@/lib/company/profile-access-credits";

type AccessStatus = "active" | "expired" | "never";

export const COMPANY_PROFILE_ACCESS_WINDOW_DAYS = Math.max(
  1,
  Number.parseInt(process.env.COMPANY_PROFILE_ACCESS_WINDOW_DAYS || "90", 10) || 90
);

const WINDOW_MS = COMPANY_PROFILE_ACCESS_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type CompanyCandidateAccess = {
  access_status: AccessStatus;
  access_granted_at: string | null;
  access_expires_at: string | null;
  source: string | null;
};

export type CompanyProfileAccessState = {
  is_unlocked: boolean;
  consumes_credit: boolean;
  remaining_accesses: number;
  unlocked_at: string | null;
  unlocked_until: string | null;
};

function toIso(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

function isMissingRelation(error: any) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("profile_view_consumptions");
}

export function deriveCompanyCandidateAccess(grantedAtRaw: unknown, sourceRaw?: unknown): CompanyCandidateAccess {
  const accessGrantedAt = toIso(grantedAtRaw);
  if (!accessGrantedAt) {
    return {
      access_status: "never",
      access_granted_at: null,
      access_expires_at: null,
      source: null,
    };
  }
  const grantedMs = Date.parse(accessGrantedAt);
  const accessExpiresAt = new Date(grantedMs + WINDOW_MS).toISOString();
  return {
    access_status: grantedMs + WINDOW_MS > Date.now() ? "active" : "expired",
    access_granted_at: accessGrantedAt,
    access_expires_at: accessExpiresAt,
    source: String(sourceRaw || "").trim() || null,
  };
}

export async function resolveCompanyCandidateAccess(args: {
  service: any;
  companyId: string;
  candidateId: string;
}) {
  const { data, error } = await args.service
    .from("profile_view_consumptions")
    .select("created_at,source")
    .eq("company_id", args.companyId)
    .eq("candidate_id", args.candidateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) return deriveCompanyCandidateAccess(null, null);
    throw error;
  }
  return deriveCompanyCandidateAccess((data as any)?.created_at, (data as any)?.source);
}

export async function resolveCompanyCandidateAccessMap(args: {
  service: any;
  companyId: string;
  candidateIds: string[];
}) {
  const ids = Array.from(new Set(args.candidateIds.map((value) => String(value || "").trim()).filter(Boolean)));
  const out = new Map<string, CompanyCandidateAccess>();
  if (ids.length === 0) return out;

  const { data, error } = await args.service
    .from("profile_view_consumptions")
    .select("candidate_id,created_at,source")
    .eq("company_id", args.companyId)
    .in("candidate_id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRelation(error)) {
      for (const candidateId of ids) out.set(candidateId, deriveCompanyCandidateAccess(null, null));
      return out;
    }
    throw error;
  }

  for (const row of Array.isArray(data) ? data : []) {
    const candidateId = String((row as any)?.candidate_id || "").trim();
    if (!candidateId || out.has(candidateId)) continue;
    out.set(candidateId, deriveCompanyCandidateAccess((row as any)?.created_at, (row as any)?.source));
  }

  for (const candidateId of ids) {
    if (!out.has(candidateId)) out.set(candidateId, deriveCompanyCandidateAccess(null, null));
  }
  return out;
}

export async function getProfileAccessState(args: {
  company_id: string;
  candidate_id: string;
  viewer_user_id?: string;
  service?: any;
}): Promise<CompanyProfileAccessState> {
  const service =
    args.service ||
    (
      await import("@/utils/supabase/service")
    ).createServiceRoleClient();
  const [access, credits] = await Promise.all([
    resolveCompanyCandidateAccess({
      service,
      companyId: args.company_id,
      candidateId: args.candidate_id,
    }),
    args.viewer_user_id
      ? resolveCompanyProfileAccessCredits({
          service,
          userId: args.viewer_user_id,
          companyId: args.company_id,
        })
      : Promise.resolve({ available: 0 }),
  ]);

  return {
    is_unlocked: access.access_status === "active",
    consumes_credit: access.access_status !== "active",
    remaining_accesses: Number(credits?.available || 0),
    unlocked_at: access.access_granted_at,
    unlocked_until: access.access_expires_at,
  };
}
