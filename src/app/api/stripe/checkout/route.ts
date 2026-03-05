import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    if (!process.env.STRIPE_PRICE_ID) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
    }
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });

  const companyId: string | null = null;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/cancel`,
      customer_email: user.email ?? undefined,

      // 🔑 Clave para que el webhook pueda mapear a user_id
      client_reference_id: user.id,

      // Metadata útil para auditoría/debug (y si luego metes company_id)
      metadata: { user_id: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("stripe_checkout_error", err?.message ?? err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
