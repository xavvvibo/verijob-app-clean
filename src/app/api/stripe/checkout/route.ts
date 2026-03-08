import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createRouteHandlerClient } from "@/utils/supabase/server";
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

  const body = await req.json().catch(() => ({}));
  const planRaw = body?.plan_key ?? body?.plan ?? body?.price_key ?? null;

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

  const origin = getOrigin(req);

  const session = await stripe.checkout.sessions.create({
    mode: selection.mode,
    line_items: [{ price: selection.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user.id,
    success_url: `${origin}/candidate/subscription?checkout=success`,
    cancel_url: `${origin}/candidate/subscription?checkout=cancel`,
    metadata: {
      user_id: user.id,
      company_id: "",
      plan_key: selection.planKey,
      price_id: selection.priceId,
    },
  });

  return NextResponse.json({ ok: true, route_version: "stripe-checkout-v1-app", url: session.url }, { status: 200 });
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
