import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { resolvePlanFromPriceId } from "@/utils/stripe/priceMapping";

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

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ ...body, route: "/pages/api/stripe/webhook" });
}

async function getRawBody(req: NextApiRequest): Promise<string> {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const secret =
      firstEnv("STRIPE_SECRET_KEY_LIVE", "STRIPE_SECRET_KEY") ??
      requireEnv("STRIPE_SECRET_KEY");
    const webhookSecret =
      firstEnv("STRIPE_WEBHOOK_SECRET_LIVE", "STRIPE_WEBHOOK_SECRET") ??
      requireEnv("STRIPE_WEBHOOK_SECRET");

    const stripe = new Stripe(secret, {
      apiVersion: "2026-02-25.clover",
    });

    const body = await getRawBody(req);
    const sig = req.headers["stripe-signature"];

    if (!sig || Array.isArray(sig)) {
      return json(res, 400, { error: "No signature" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        webhookSecret
      );
    } catch {
      return json(res, 400, { error: "Invalid signature" });
    }

    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    async function resolveUserIdForSubscription(subscription: Stripe.Subscription): Promise<string | null> {
      const fromMetadata = String((subscription.metadata as any)?.user_id || "").trim();
      if (fromMetadata) return fromMetadata;

      try {
        const sessions = await stripe.checkout.sessions.list({
          subscription: subscription.id,
          limit: 1,
        });
        const s = sessions?.data?.[0];
        const fromClientRef = String(s?.client_reference_id || "").trim();
        if (fromClientRef) return fromClientRef;
        const fromSessionMeta = String((s?.metadata as any)?.user_id || "").trim();
        if (fromSessionMeta) return fromSessionMeta;
      } catch {
        // no-op, fallback below
      }

      const { data: existingByCustomer } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", String(subscription.customer || ""))
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const fromDb = String(existingByCustomer?.user_id || "").trim();
      if (fromDb) return fromDb;
      return null;
    }

    async function persistSubscriptionRow(row: Record<string, any>) {
      const primary = await supabase
        .from("subscriptions")
        .upsert(row, { onConflict: "stripe_subscription_id" });

      if (!primary.error) return;

      const fallback = await supabase
        .from("subscriptions")
        .upsert(row, { onConflict: "user_id" });

      if (fallback.error) {
        throw new Error(
          `Supabase upsert failed (stripe_subscription_id=${primary.error.message}; user_id=${fallback.error.message})`
        );
      }
    }

    async function upsertSubscription(args: {
      userId?: string | null;
      checkoutSessionId?: string | null;
      subscriptionId: string;
      sourceEvent: string;
    }) {
      const subscription = await stripe.subscriptions.retrieve(args.subscriptionId, {
        expand: ["items.data.price"],
      });

      const userId = String(args.userId || "").trim() || (await resolveUserIdForSubscription(subscription));
      if (!userId) {
        throw new Error(`user_id_unresolved_for_subscription_${subscription.id}`);
      }

      const cpe: unknown = (subscription as any)?.current_period_end;
      const periodEnd = typeof cpe === "number" ? new Date(cpe * 1000) : null;

      const priceId =
        subscription.items?.data?.[0]?.price &&
        typeof subscription.items.data[0].price !== "string"
          ? subscription.items.data[0].price.id
          : (subscription.items?.data?.[0]?.price as any)?.id ?? null;
      const resolved = resolvePlanFromPriceId(priceId);

      await persistSubscriptionRow({
        user_id: userId,
        stripe_customer_id: (subscription.customer as string) ?? null,
        stripe_subscription_id: subscription.id,
        plan: resolved?.planKey ?? priceId,
        status: subscription.status,
        current_period_end: periodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        stripe_checkout_session_id: args.checkoutSessionId ?? null,
        metadata: {
          ...(subscription.metadata ?? {}),
          price_id: priceId,
          resolved_plan_key: resolved?.planKey ?? null,
          sync_source_event: args.sourceEvent,
        },
        updated_at: new Date(),
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const subscriptionId = session.subscription as string | null;

      if (userId && subscriptionId) {
        await upsertSubscription({
          userId,
          checkoutSessionId: session.id,
          subscriptionId,
          sourceEvent: event.type,
        });
      }

      return json(res, 200, { received: true, event_type: event.type, event_id: event.id });
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub?.id) {
        await upsertSubscription({
          subscriptionId: sub.id,
          sourceEvent: event.type,
        });
      }
      return json(res, 200, { received: true, event_type: event.type, event_id: event.id });
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as any;
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : ((invoice.subscription as any)?.id ?? null);
      if (subscriptionId) {
        await upsertSubscription({
          subscriptionId,
          sourceEvent: event.type,
        });
      }
      return json(res, 200, { received: true, event_type: event.type, event_id: event.id });
    }

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
      return json(res, 200, { received: true, event_type: event.type, event_id: event.id });
    }

    return json(res, 200, { received: true, event_type: event.type, event_id: event.id });
  } catch (e: any) {
    console.error("[stripe-webhook] fatal:", {
      message: e?.message ?? String(e),
      stack: e?.stack ?? null,
    });
    return json(res, 500, { error: "Webhook handler failed", details: e?.message ?? String(e) });
  }
}
