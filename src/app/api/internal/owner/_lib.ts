import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function requireOwner() {
  const supabase = await createRouteHandlerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profErr || !profile) {
    return { ok: false as const, status: 403, error: "profile_not_found" };
  }

  const role = String(profile.role || "").toLowerCase();
  if (role !== "owner" && role !== "admin") {
    return { ok: false as const, status: 403, error: "forbidden" };
  }

  return {
    ok: true as const,
    ownerId: String(auth.user.id),
    admin: createServiceRoleClient(),
  };
}

export function parseDurationDays(value: string | null | undefined): number | null {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "7_dias") return 7;
  if (v === "14_dias") return 14;
  if (v === "30_dias") return 30;
  if (v === "90_dias") return 90;
  if (v === "sin_caducidad") return null;
  const parsed = Number(v);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return null;
}

export function addDaysIso(days: number | null): string | null {
  if (!days || days <= 0) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function genPromoCode(prefix = "VJ") {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${stamp}${rand}`;
}
