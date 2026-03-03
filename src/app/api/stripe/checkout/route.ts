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

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/cancel`,
      customer_email: user.email ?? undefined,
    });

    return NextResponse.json({ url: session.url });

  } catch (err) {
    console.error("stripe_checkout_error", err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
