import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { resolvePriceForPlan } from "@/utils/stripe/priceMapping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CandidatePaidPlan =
  | "candidate_starter_monthly"
  | "candidate_pro_monthly"
  | "candidate_proplus_monthly"
  | "candidate_proplus_yearly";

type CandidateTargetPlan = CandidatePaidPlan | "free";

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

function normalizeCurrentTier(planRaw: unknown): CandidateTargetPlan {
  const plan = String(planRaw || "").trim().toLowerCase();
  if (plan === "candidate_starter_monthly") return "candidate_starter_monthly";
  if (plan === "candidate_pro_monthly") return "candidate_pro_monthly";
  if (plan === "candidate_proplus_monthly") return "candidate_proplus_monthly";
  if (plan === "candidate_proplus_yearly") return "candidate_proplus_yearly";
  return "free";
}

function normalizeTargetPlan(planRaw: unknown): CandidateTargetPlan | null {
  const plan = String(planRaw || "").trim().toLowerCase();
  if (plan === "free") return "free";
  if (plan === "candidate_starter_monthly") return "candidate_starter_monthly";
  if (plan === "candidate_pro_monthly") return "candidate_pro_monthly";
  if (plan === "candidate_proplus_monthly") return "candidate_proplus_monthly";
  if (plan === "candidate_proplus_yearly") return "candidate_proplus_yearly";
  return null;
}

function allowedDowngradeTargets(current: CandidateTargetPlan): CandidateTargetPlan[] {
  if (current === "candidate_proplus_yearly" || current === "candidate_proplus_monthly") {
    return ["candidate_pro_monthly", "candidate_starter_monthly", "free"];
  }
  if (current === "candidate_pro_monthly") {
    return ["candidate_starter_monthly", "free"];
  }
  if (current === "candidate_starter_monthly") {
    return ["free"];
  }
  return [];
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteHandlerClient();
    const stripe = getStripe();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "unauthorized", details: authErr?.message ?? null }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetPlan = normalizeTargetPlan(body?.target_plan_key);
    if (!targetPlan) {
      return NextResponse.json({ error: "invalid_target_plan" }, { status: 400 });
    }

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("id,plan,status,stripe_subscription_id,current_period_end,cancel_at_period_end,metadata")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "trial"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) {
      return NextResponse.json({ error: "subscriptions_read_failed", details: subErr.message }, { status: 400 });
    }

    if (!sub?.stripe_subscription_id) {
      return NextResponse.json({ error: "no_active_subscription" }, { status: 400 });
    }

    const currentPlan = normalizeCurrentTier(sub.plan);
    const validTargets = allowedDowngradeTargets(currentPlan);
    if (!validTargets.includes(targetPlan)) {
      return NextResponse.json({ error: "unsupported_downgrade_for_current_plan" }, { status: 400 });
    }

    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
      expand: ["items.data.price", "schedule"],
    });

    const cpeUnix = typeof (subscription as any)?.current_period_end === "number"
      ? (subscription as any).current_period_end
      : null;
    const cpsUnix = typeof (subscription as any)?.current_period_start === "number"
      ? (subscription as any).current_period_start
      : null;

    if (!cpeUnix || !cpsUnix) {
      return NextResponse.json({ error: "subscription_period_unavailable" }, { status: 400 });
    }

    const effectiveAtIso = new Date(cpeUnix * 1000).toISOString();
    const baseMetadata = (sub.metadata && typeof sub.metadata === "object" ? sub.metadata : {}) as Record<string, any>;
    const metadataPatch = {
      ...baseMetadata,
      scheduled_change: {
        type: "downgrade",
        target_plan_key: targetPlan,
        effective_at: effectiveAtIso,
      },
    };

    if (targetPlan === "free") {
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
        metadata: {
          ...(subscription.metadata ?? {}),
          scheduled_change_type: "downgrade",
          scheduled_target_plan_key: "free",
        },
      });
    } else {
      const targetPrice = resolvePriceForPlan(targetPlan);

      let scheduleId: string;
      if (subscription.schedule) {
        scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id;
      } else {
        const created = await stripe.subscriptionSchedules.create({
          from_subscription: subscription.id,
        });
        scheduleId = created.id;
      }

      const currentPriceId =
        subscription.items?.data?.[0]?.price &&
        typeof subscription.items.data[0].price !== "string"
          ? subscription.items.data[0].price.id
          : (subscription.items?.data?.[0]?.price as any)?.id;

      if (!currentPriceId) {
        return NextResponse.json({ error: "current_price_not_found" }, { status: 400 });
      }

      await stripe.subscriptionSchedules.update(scheduleId, {
        end_behavior: "release",
        phases: [
          {
            start_date: cpsUnix,
            end_date: cpeUnix,
            items: [{ price: currentPriceId, quantity: 1 }],
            proration_behavior: "none",
          },
          {
            start_date: cpeUnix,
            items: [{ price: targetPrice.priceId, quantity: 1 }],
            proration_behavior: "none",
          },
        ],
        metadata: {
          scheduled_change_type: "downgrade",
          scheduled_target_plan_key: targetPlan,
        },
      });
    }

    const { error: upErr } = await supabase
      .from("subscriptions")
      .update({
        metadata: metadataPatch,
        cancel_at_period_end: targetPlan === "free" ? true : sub.cancel_at_period_end ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    if (upErr) {
      return NextResponse.json({ error: "subscription_update_failed", details: upErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      scheduled: {
        type: "downgrade",
        target_plan_key: targetPlan,
        effective_at: effectiveAtIso,
      },
      route_version: "stripe-change-plan-v1",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "change_plan_failed" }, { status: 500 });
  }
}
