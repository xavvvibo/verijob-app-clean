import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-02-25.clover",
});

function getOrigin(): string {
  // Prefer request origin; fallback to production.
  return "https://app.verijob.es";
}

async function createCheckoutSession() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) as any };
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return { error: NextResponse.json({ error: "missing_STRIPE_PRICE_ID" }, { status: 500 }) as any };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: NextResponse.json({ error: "missing_STRIPE_SECRET_KEY" }, { status: 500 }) as any };
  }

  // Derivar origin real si viene (por si pruebas en preview/local)
  let origin = getOrigin();
  try {
    const h = await headers();
    const reqOrigin = h.get("origin") || h.get("x-forwarded-host");
    if (reqOrigin) {
      if (reqOrigin.startsWith("http")) origin = reqOrigin;
      else origin = `https://${reqOrigin}`;
    }
  } catch {
    // ignore
  }

  // TODO (más adelante): resolver active_company_id real si quieres atribución B2B.
  const companyId: string | null = null;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/dashboard?checkout=cancel`,
    metadata: {
      user_id: user.id,
      company_id: companyId,
      price_id: priceId,
    },
  });

  return { url: session.url as string };
}

export async function GET() {
  // UI-friendly: abrir en navegador => redirige directo a Stripe Checkout
  const res = await createCheckoutSession();
  if ((res as any).error) return (res as any).error;

  const url = (res as any).url as string;
  return NextResponse.redirect(url, { status: 302 });
}

export async function POST() {
  // API-friendly: devuelve JSON con la URL
  const res = await createCheckoutSession();
  if ((res as any).error) return (res as any).error;

  return NextResponse.json({ route_version: "stripe-checkout-v2-get+post", url: (res as any).url });
}
