import { normalizeLifecycleStatus } from "@/lib/account/lifecycle";

export async function readCompanyLifecycle(admin: any, companyId: string) {
  const { data, error } = await admin
    .from("companies")
    .select("id,lifecycle_status,deleted_at")
    .eq("id", companyId)
    .maybeSingle();
  if (error) {
    return {
      ok: false as const,
      error,
      lifecycleStatus: "active",
    };
  }
  return {
    ok: true as const,
    lifecycleStatus: normalizeLifecycleStatus((data as any)?.lifecycle_status),
    company: data || null,
  };
}

export function isCompanyLifecycleBlocked(value: unknown) {
  const status = normalizeLifecycleStatus(value);
  return status === "disabled" || status === "scheduled_for_deletion" || status === "deleted";
}

