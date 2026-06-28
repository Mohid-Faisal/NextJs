import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

let cached: Stripe | null = null;

/** Lazily build the Stripe client; returns null if not configured. */
export function getStripe(): Stripe | null {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  cached = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Resolve the Stripe Price id for a plan. Prefers the price stored in the
 * plan's `features.stripePriceId`, then falls back to an env var per code
 * (e.g. STRIPE_PRICE_STARTER).
 */
export function resolvePriceId(planCode: string, featurePriceId?: string): string | null {
  if (featurePriceId) return featurePriceId;
  const envKey = `STRIPE_PRICE_${planCode.toUpperCase()}`;
  return process.env[envKey] ?? null;
}

/** Map a Stripe subscription status to our internal subscription + org status. */
export function mapStripeStatus(stripeStatus: string): {
  subscriptionStatus: string;
  orgStatus: "active" | "suspended" | "trial";
} {
  switch (stripeStatus) {
    case "active":
      return { subscriptionStatus: "active", orgStatus: "active" };
    case "trialing":
      return { subscriptionStatus: "trialing", orgStatus: "trial" };
    case "past_due":
    case "unpaid":
      return { subscriptionStatus: "past_due", orgStatus: "suspended" };
    case "canceled":
    case "incomplete_expired":
      return { subscriptionStatus: "canceled", orgStatus: "suspended" };
    default:
      // incomplete / paused / unknown — keep usable but mark non-active.
      return { subscriptionStatus: stripeStatus, orgStatus: "active" };
  }
}

/**
 * Apply a billing status transition to an org: updates the subscription row
 * and the org status (suspend-on-unpaid). Never suspends the platform org.
 */
export async function applySubscriptionStatus(
  organizationId: number,
  opts: {
    subscriptionStatus: string;
    orgStatus: "active" | "suspended" | "trial";
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    currentPeriodEnd?: Date | null;
    planId?: number;
  }
): Promise<void> {
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      status: opts.subscriptionStatus,
      ...(opts.planId !== undefined ? { planId: opts.planId } : {}),
      ...(opts.stripeSubscriptionId !== undefined
        ? { stripeSubscriptionId: opts.stripeSubscriptionId }
        : {}),
      ...(opts.stripeCustomerId !== undefined
        ? { stripeCustomerId: opts.stripeCustomerId }
        : {}),
      ...(opts.currentPeriodEnd !== undefined
        ? { currentPeriodEnd: opts.currentPeriodEnd }
        : {}),
    },
  });

  // Don't ever auto-suspend the platform's own workspace.
  if (organizationId !== 1) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: opts.orgStatus },
    });
  }
}
