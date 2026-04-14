import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { normalizeCandidatePublicToken, resolveActiveCandidatePublicLink } from "@/lib/public/candidate-public-link";
import { normalizeCompanyProfileAccessProductKey } from "@/lib/company/profile-access-products";
import { getProfileAccessState } from "@/lib/company/profile-access";

type Params = { token: string };

export const runtime = "nodejs";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function resolveConsumptionSource(args: {
  service: ReturnType<typeof createServiceRoleClient>;
  companyId: string;
  viewerUserId: string;
}) {
  const latestPurchase = await args.service
    .from("stripe_oneoff_purchases")
    .select("product_key,created_at")
    .eq("company_id", args.companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const purchaseKey = normalizeCompanyProfileAccessProductKey((latestPurchase.data as any)?.product_key);
  if (purchaseKey === "company_single_cv") return "single_unlock";
  if (purchaseKey === "company_pack_5") return "pack_credit";

  const latestGrant = await args.service
    .from("credit_grants")
    .select("source_type,metadata,created_at")
    .eq("user_id", args.viewerUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sourceType = String((latestGrant.data as any)?.source_type || "").trim().toLowerCase();
  const productKey = normalizeCompanyProfileAccessProductKey((latestGrant.data as any)?.metadata?.product_key);
  if (productKey === "company_single_cv") return "single_unlock";
  if (productKey === "company_pack_5") return "pack_credit";
  if (sourceType.includes("promo")) return "promo";
  return "grant";
}

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { token: tokenParam } = await ctx.params;
  const normalizedToken = normalizeCandidatePublicToken(tokenParam);
  const supabase = await createClient();
  const { data: au, error: auErr } = await supabase.auth.getUser();
  if (auErr || !au?.user) return json(401, { error: "Unauthorized" });

  const { data: requesterProfile, error: requesterErr } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", au.user.id)
    .maybeSingle();
  if (requesterErr) return json(400, { error: "Profile read failed", details: requesterErr.message });

  const companyId = String((requesterProfile as any)?.active_company_id || "").trim();
  if (!companyId) return json(403, { error: "Company context required" });

  const service = createServiceRoleClient();
  const linkResolved = await resolveActiveCandidatePublicLink(service, normalizedToken);
  if (!linkResolved.ok || !linkResolved.link?.candidate_id) {
    return json(404, { error: "Candidate not found" });
  }

  const candidateId = String(linkResolved.link.candidate_id || "").trim();
  if (!candidateId) return json(404, { error: "Candidate not found" });

  const accessState = await getProfileAccessState({
    service,
    company_id: companyId,
    candidate_id: candidateId,
    viewer_user_id: au.user.id,
  });

  if (!accessState.consumes_credit) {
    return json(200, {
      success: true,
      unlocked: true,
      consumed: false,
      remaining: accessState.remaining_accesses,
      remaining_accesses: accessState.remaining_accesses,
      unlocked_at: accessState.unlocked_at,
      unlocked_until: accessState.unlocked_until,
    });
  }

  if (accessState.remaining_accesses <= 0) {
    return json(402, {
      error: "no_accesses_remaining",
      user_message: "No tienes accesos disponibles para desbloquear este perfil.",
      remaining_accesses: 0,
    });
  }

  const source = await resolveConsumptionSource({
    service,
    companyId,
    viewerUserId: au.user.id,
  });

  const insertRes = await service.from("profile_view_consumptions").insert({
    company_id: companyId,
    viewer_user_id: au.user.id,
    candidate_id: candidateId,
    credits_spent: 1,
    source,
  });

  if (insertRes.error) {
    return json(500, {
      error: "unlock_persistence_failed",
      details: insertRes.error.message,
    });
  }

  const reloadedState = await getProfileAccessState({
    service,
    company_id: companyId,
    candidate_id: candidateId,
    viewer_user_id: au.user.id,
  });

  if (!reloadedState.is_unlocked) {
    return json(409, {
      error: "unlock_not_persisted",
      user_message: "El perfil no quedó desbloqueado correctamente.",
      remaining_accesses: reloadedState.remaining_accesses,
      unlocked_at: reloadedState.unlocked_at,
    });
  }

  return json(200, {
    success: true,
    unlocked: true,
    consumed: true,
    remaining: reloadedState.remaining_accesses,
    remaining_accesses: reloadedState.remaining_accesses,
    unlocked_at: reloadedState.unlocked_at,
    unlocked_until: reloadedState.unlocked_until,
  });
}
