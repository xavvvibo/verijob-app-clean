import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2026-02-25.clover",
    });

    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        requireEnv("STRIPE_WEBHOOK_SECRET")
      );
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Service role: debe persistir aunque RLS esté ON
    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    async function upsertSubscription(args: {
      userId: string;
      checkoutSessionId?: string | null;
      subscriptionId: string;
    }) {
      // Recupera la suscripción REAL desde Stripe para evitar payload parcial en eventos
      const subscription = await stripe.subscriptions.retrieve(args.subscriptionId, {
        expand: ["items.data.price"],
      });

      const periodEnd =
        typeof subscription.current_period_end === "number"
          ? new Date(subscription.current_period_end * 1000)
          : null;

      const priceId =
        subscription.items?.data?.[0]?.price &&
        typeof subscription.items.data[0].price !== "string"
          ? subscription.items.data[0].price.id
          : (subscription.items?.data?.[0]?.price as any)?.id ?? null;

      const { error } = await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: args.userId,
            stripe_customer_id: (subscription.customer as string) ?? null,
            stripe_subscription_id: subscription.id,
            plan: priceId,
            status: subscription.status,
            current_period_end: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            stripe_checkout_session_id: args.checkoutSessionId ?? null,
            metadata: subscription.metadata ?? {},
            updated_at: new Date(),
          },
          { onConflict: "stripe_subscription_id" }
        );

      if (error) {
        // Si Supabase falla, forzamos retry de Stripe (devolvemos 500)
        throw new Error(`Supabase upsert subscriptions failed: ${error.message}`);
      }
    }

    async function updateFromSubscriptionId(subscriptionId: string) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });

      const periodEnd =
        typeof subscription.current_period_end === "number"
          ? new Date(subscription.current_period_end * 1000)
          : null;

      const priceId =
        subscription.items?.data?.[0]?.price &&
        typeof subscription.items.data[0].price !== "string"
          ? subscription.items.data[0].price.id
          : (subscription.items?.data?.[0]?.price as any)?.id ?? null;

      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: subscription.status,
          plan: priceId,
          current_period_end: periodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          metadata: subscription.metadata ?? {},
          updated_at: new Date(),
        })
        .eq("stripe_subscription_id", subscription.id);

      if (error) {
        throw new Error(`Supabase update subscriptions failed: ${error.message}`);
      }
    }

    // =========================================================
    // CHECKOUT COMPLETED
    // =========================================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Tu sistema usa client_reference_id como user_id (ok).
      const userId = session.client_reference_id;
      const subscriptionId = session.subscription as string | null;

      if (userId && subscriptionId) {
        await upsertSubscription({
          userId,
          checkoutSessionId: session.id,
          subscriptionId,
        });
      }

      return NextResponse.json({ received: true });
    }

    // =========================================================
    // SUBSCRIPTION UPDATED
    // =========================================================
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub?.id) await updateFromSubscriptionId(sub.id);
      return NextResponse.json({ received: true });
    }

    // =========================================================
    // SUBSCRIPTION DELETED
    // =========================================================
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub?.id) {
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: true,
            updated_at: new Date(),
          })
          .eq("stripe_subscription_id", sub.id);

        if (error) throw new Error(`Supabase cancel update failed: ${error.message}`);
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("[stripe-webhook] fatal:", e?.message ?? e);
    // 500 => Stripe reintenta y no “perdemos” persistencia silenciosa
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
