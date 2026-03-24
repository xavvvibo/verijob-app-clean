import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { normalizeCompanyProfileAccessProductKey } from "@/lib/company/profile-access-products";
import { resolvePriceForPlan } from "@/utils/stripe/priceMapping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function firstEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim().length > 0) return String(value).trim();
  }
  return null;
}

function getStripe() {
  const secret = firstEnv("STRIPE_SECRET_KEY_LIVE", "STRIPE_SECRET_KEY") ?? requireEnv("STRIPE_SECRET_KEY");
  return new Stripe(secret, { apiVersion: "2026-02-25.clover" });
}

function getOrigin(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");

  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host || "app.verijob.es";
  return `${proto}://${host}`;
}

function toOwnerProductKey(planKey: string | null) {
  const canonical = normalizeCompanyProfileAccessProductKey(planKey);
  if (canonical) return canonical;
  const normalized = String(planKey || "").trim().toLowerCase();
  return normalized || null;
}

function isCompanyPlanKey(planKey: string | null) {
  return String(planKey || "").trim().toLowerCase().startsWith("company_");
}

function isCandidatePlanKey(planKey: string | null) {
  return String(planKey || "").trim().toLowerCase().startsWith("candidate_");
}

async function createCheckoutSession(req: Request) {
  const stripe = getStripe();
  const supabase = await createRouteHandlerClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", details: authErr?.message ?? null }, { status: 401 });
  }

  const url = new URL(req.url);
  const body =
    req.method === "POST"
      ? await req.json().catch(() => ({}))
      : {};
  const planRaw =
    body?.plan_key ??
    body?.plan ??
    body?.price_key ??
    url.searchParams.get("plan_key") ??
    url.searchParams.get("plan") ??
    url.searchParams.get("price_key") ??
    null;
  const returnPathRaw =
    body?.return_path ??
    body?.returnPath ??
    url.searchParams.get("return_path") ??
    url.searchParams.get("returnTo") ??
    null;

  let selection: { planKey: string; priceId: string; mode: "subscription" | "payment" };
  try {
    selection = resolvePriceForPlan(planRaw);
  } catch (e: any) {
    if (e?.message === "enterprise_contact_only") {
      return NextResponse.json({ error: "enterprise_contact_only" }, { status: 400 });
    }
    if (String(e?.message || "").startsWith("missing_env_")) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    return NextResponse.json({ error: "unsupported_plan", details: String(planRaw ?? "") }, { status: 400 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role,active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    return NextResponse.json({ error: "profile_context_unavailable", details: profileErr.message }, { status: 400 });
  }

  const actorRole = String((profile as any)?.role || "").trim().toLowerCase();
  const isCompanyPlan = isCompanyPlanKey(selection.planKey);
  const isCandidatePlan = isCandidatePlanKey(selection.planKey);
  const isOneoffPurchase = selection.mode === "payment";

  if (isCompanyPlan && actorRole !== "company") {
    return NextResponse.json({ error: "company_plan_requires_company_role" }, { status: 403 });
  }

  if (isCandidatePlan && actorRole === "company") {
    return NextResponse.json({ error: "candidate_plan_requires_candidate_role" }, { status: 403 });
  }

  let activeCompanyId = "";
  if (isCompanyPlan) {
    activeCompanyId = String((profile as any)?.active_company_id || "").trim();
    if (!activeCompanyId) {
      return NextResponse.json({ error: "company_context_required" }, { status: 403 });
    }
  }

  const origin = getOrigin(req);
  const safeReturnPath =
    typeof returnPathRaw === "string" && returnPathRaw.startsWith("/") && !returnPathRaw.startsWith("//")
      ? returnPathRaw
      : null;
  const defaultSuccess = isCompanyPlan ? "/company/subscription?checkout=success" : "/candidate/subscription?checkout=success";
  const defaultCancel = isCompanyPlan ? "/company/subscription?checkout=cancel" : "/candidate/subscription?checkout=cancel";
  const successPath = safeReturnPath ? `${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}checkout=success` : defaultSuccess;
  const cancelPath = safeReturnPath ? `${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}checkout=cancel` : defaultCancel;
  const successUrl = `${origin}${successPath}`;
  const cancelUrl = `${origin}${cancelPath}`;
  const baseMetadata = {
    user_id: user.id,
    company_id: activeCompanyId,
    actor_role: actorRole,
    plan_key: selection.planKey,
    product_key: toOwnerProductKey(selection.planKey) || "",
    price_id: selection.priceId,
    checkout_kind: isOneoffPurchase ? "oneoff_purchase" : "subscription",
    return_path: safeReturnPath || "",
  };

  const sessionPayload: Stripe.Checkout.SessionCreateParams = {
    mode: selection.mode,
    line_items: [{ price: selection.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: baseMetadata,
  };

  if (selection.mode === "subscription") {
    sessionPayload.subscription_data = {
      metadata: baseMetadata,
    };
  } else {
    sessionPayload.payment_intent_data = {
      metadata: baseMetadata,
    };
  }

  const session = await stripe.checkout.sessions.create(sessionPayload);

  return NextResponse.json(
    {
      ok: true,
      route_version: "stripe-checkout-v2-app",
      url: session.url,
      checkout: {
        mode: selection.mode,
        plan_key: selection.planKey,
        price_id: selection.priceId,
      },
    },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  try {
    return await createCheckoutSession(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Checkout error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    return await createCheckoutSession(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Checkout error" }, { status: 500 });
  }
}
