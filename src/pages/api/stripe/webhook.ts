import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { resolvePlanFromPriceId } from "@/utils/stripe/priceMapping";
import { buildSubscriptionLifecycleEmail } from "@/lib/email/templates/subscriptionLifecycle";
import { sendTransactionalEmail } from "@/server/email/sendTransactionalEmail";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";

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

function resolveAppUrl() {
  return String(process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es").replace(/\/+$/, "");
}

function planLabel(raw: unknown) {
  const plan = String(raw || "free").toLowerCase();
  if (!plan || plan === "free") return "Free";
  if (plan.includes("candidate_starter")) return "Candidate Starter";
  if (plan.includes("candidate_proplus")) return "Candidate Pro+";
  if (plan.includes("candidate_pro")) return "Candidate Pro";
  if (plan.includes("company_access")) return "Company Access";
  if (plan.includes("company_hiring")) return "Company Hiring";
  if (plan.includes("company_team")) return "Company Team";
  return plan;
}

function isCompanyPlan(raw: unknown) {
  return String(raw || "").toLowerCase().startsWith("company_");
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

    async function resolveUserEmail(userId: string): Promise<string | null> {
      const authRes = await supabase.auth.admin.getUserById(userId);
      const authEmail = String(authRes?.data?.user?.email || "").trim().toLowerCase();
      if (authEmail) return authEmail;

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      const profileEmail = String((profile as any)?.email || "").trim().toLowerCase();
      return profileEmail || null;
    }

    async function sendSubscriptionEmail(args: {
      kind: "plan_updated" | "owner_plan_updated" | "trial_extended" | "payment_failed" | "subscription_changed" | "subscription_renewed";
      userId: string;
      planKey?: string | null;
      previousPlanKey?: string | null;
      immediate?: boolean;
      effectiveAt?: string | null;
      periodEnd?: string | null;
      reason?: string | null;
      sourceEvent: string;
      sourceEventId: string;
    }) {
      const to = await resolveUserEmail(args.userId);
      if (!to) {
        await trackEventAdmin({
          event_name: "subscription_started",
          user_id: args.userId,
          metadata: {
            email_notification: "skipped_no_email",
            source_event: args.sourceEvent,
            source_event_id: args.sourceEventId,
            notification_kind: args.kind,
          },
        });
        return { ok: false, error: "user_email_unavailable" };
      }

      const appUrl = resolveAppUrl();
      const isCompany = isCompanyPlan(args.planKey) || isCompanyPlan(args.previousPlanKey);
      const dashboardUrl = isCompany ? `${appUrl}/company/subscription` : `${appUrl}/candidate/subscription`;
      const billingUrl = isCompany ? `${appUrl}/company/subscription` : `${appUrl}/candidate/subscription`;
      const tpl = buildSubscriptionLifecycleEmail({
        kind: args.kind,
        planName: planLabel(args.planKey),
        previousPlanName: args.previousPlanKey ? planLabel(args.previousPlanKey) : null,
        effectiveAt: args.effectiveAt || null,
        periodEnd: args.periodEnd || null,
        immediate: args.immediate,
        reason: args.reason || null,
        dashboardUrl,
        billingUrl,
      });
      const sent = await sendTransactionalEmail({
        to,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      await trackEventAdmin({
        event_name: "subscription_started",
        user_id: args.userId,
        metadata: {
          email_notification: sent.ok ? "sent" : sent.skipped ? "skipped" : "failed",
          provider: sent.provider,
          provider_message_id: sent.id || null,
          source_event: args.sourceEvent,
          source_event_id: args.sourceEventId,
          notification_kind: args.kind,
          error: sent.error || null,
          plan_key: args.planKey || null,
          previous_plan_key: args.previousPlanKey || null,
        },
      });
      return sent;
    }

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
    }): Promise<{ userId: string; planKey: string | null; previousPlanKey: string | null; periodEndIso: string | null; cancelAtPeriodEnd: boolean }> {
      const { data: previousByStripe } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("stripe_subscription_id", args.subscriptionId)
        .limit(1)
        .maybeSingle();

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

      return {
        userId,
        planKey: resolved?.planKey ?? (priceId ? String(priceId) : null),
        previousPlanKey: previousByStripe?.plan ? String(previousByStripe.plan) : null,
        periodEndIso: periodEnd ? periodEnd.toISOString() : null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      };
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const subscriptionId = session.subscription as string | null;

      if (userId && subscriptionId) {
        const subCtx = await upsertSubscription({
          userId,
          checkoutSessionId: session.id,
          subscriptionId,
          sourceEvent: event.type,
        });
        await sendSubscriptionEmail({
          kind: "plan_updated",
          userId: subCtx.userId,
          planKey: subCtx.planKey,
          previousPlanKey: subCtx.previousPlanKey,
          immediate: true,
          periodEnd: subCtx.periodEndIso,
          sourceEvent: event.type,
          sourceEventId: event.id,
        });
      }

      return json(res, 200, { received: true, event_type: event.type, event_id: event.id });
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub?.id) {
        const subCtx = await upsertSubscription({
          subscriptionId: sub.id,
          sourceEvent: event.type,
        });

        if (event.type === "customer.subscription.updated") {
          const prev = ((event as any)?.data?.previous_attributes || {}) as Record<string, any>;
          const becameCancelAtPeriodEnd =
            typeof prev.cancel_at_period_end === "boolean" &&
            prev.cancel_at_period_end === false &&
            sub.cancel_at_period_end === true;
          const itemsChanged = Boolean(prev.items);
          if (becameCancelAtPeriodEnd) {
            await sendSubscriptionEmail({
              kind: "subscription_changed",
              userId: subCtx.userId,
              planKey: subCtx.planKey,
              previousPlanKey: subCtx.previousPlanKey,
              immediate: false,
              effectiveAt: subCtx.periodEndIso,
              periodEnd: subCtx.periodEndIso,
              reason: "La cancelación o downgrade se aplicará al final del periodo.",
              sourceEvent: event.type,
              sourceEventId: event.id,
            });
          } else if (itemsChanged && subCtx.previousPlanKey && subCtx.previousPlanKey !== subCtx.planKey) {
            await sendSubscriptionEmail({
              kind: "plan_updated",
              userId: subCtx.userId,
              planKey: subCtx.planKey,
              previousPlanKey: subCtx.previousPlanKey,
              immediate: true,
              periodEnd: subCtx.periodEndIso,
              sourceEvent: event.type,
              sourceEventId: event.id,
            });
          }
        }
      }
      return json(res, 200, { received: true, event_type: event.type, event_id: event.id });
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as any;
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : ((invoice.subscription as any)?.id ?? null);
      if (subscriptionId) {
        const subCtx = await upsertSubscription({
          subscriptionId,
          sourceEvent: event.type,
        });
        if (String(invoice?.billing_reason || "").toLowerCase() === "subscription_cycle") {
          await sendSubscriptionEmail({
            kind: "subscription_renewed",
            userId: subCtx.userId,
            planKey: subCtx.planKey,
            periodEnd: subCtx.periodEndIso,
            sourceEvent: event.type,
            sourceEventId: event.id,
          });
        }
      }
      return json(res, 200, { received: true, event_type: event.type, event_id: event.id });
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as any;
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : ((invoice.subscription as any)?.id ?? null);
      if (subscriptionId) {
        const subCtx = await upsertSubscription({
          subscriptionId,
          sourceEvent: event.type,
        });
        await sendSubscriptionEmail({
          kind: "payment_failed",
          userId: subCtx.userId,
          planKey: subCtx.planKey,
          periodEnd: subCtx.periodEndIso,
          sourceEvent: event.type,
          sourceEventId: event.id,
        });
      }
      return json(res, 200, { received: true, event_type: event.type, event_id: event.id });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub?.id) {
        const previousSub = await supabase
          .from("subscriptions")
          .select("user_id,plan,current_period_end")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: true,
            updated_at: new Date(),
          })
          .eq("stripe_subscription_id", sub.id);

        if (error) throw new Error(`Supabase cancel update failed: ${error.message}`);

        const userId = String(previousSub.data?.user_id || "").trim() || (await resolveUserIdForSubscription(sub));
        if (userId) {
          await sendSubscriptionEmail({
            kind: "subscription_changed",
            userId,
            planKey: String(previousSub.data?.plan || "free"),
            immediate: true,
            periodEnd: previousSub.data?.current_period_end ? new Date(previousSub.data.current_period_end).toISOString() : null,
            reason: "Tu suscripción ha sido cancelada.",
            sourceEvent: event.type,
            sourceEventId: event.id,
          });
        }
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
