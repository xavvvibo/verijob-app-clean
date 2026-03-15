import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  readEffectiveCompanySubscriptionState,
  readEffectiveSubscriptionState,
} from "@/lib/billing/effectiveSubscription";

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

function getAppUrl(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");

  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host || "app.verijob.es";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const appUrl = getAppUrl(req);
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "unauthorized", details: authErr?.message ?? null }, { status: 401 });
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("role,active_company_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) {
      return NextResponse.json({ error: "profiles_read_failed", details: profileErr.message }, { status: 400 });
    }

    const role = String((profile as any)?.role || "").toLowerCase();
    const activeCompanyId = String((profile as any)?.active_company_id || "").trim();
    const effective =
      role === "company" && activeCompanyId
        ? await readEffectiveCompanySubscriptionState(admin, { userId: user.id, companyId: activeCompanyId })
        : await readEffectiveSubscriptionState(admin, user.id);
    const sub = effective.subscription;

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: "no_active_subscription" }, { status: 400 });
    }

    const returnPath = String(sub?.plan || "").startsWith("company_")
      ? "/company/subscription"
      : "/candidate/subscription";

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}${returnPath}`,
    });

    return NextResponse.json({ ok: true, route_version: "stripe-portal-v1-app", url: session.url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Portal error" }, { status: 500 });
  }
}
