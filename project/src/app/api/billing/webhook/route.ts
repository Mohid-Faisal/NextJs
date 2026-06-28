import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, mapStripeStatus, applySubscriptionStatus } from "@/lib/billing/stripe";

// Stripe needs the raw, unparsed request body to verify the signature.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Find which org a Stripe object belongs to. */
async function resolveOrgId(opts: {
  metadataOrgId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
}): Promise<number | null> {
  if (opts.metadataOrgId) {
    const n = parseInt(opts.metadataOrgId, 10);
    if (!isNaN(n)) return n;
  }
  if (opts.stripeSubscriptionId) {
    const sub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: opts.stripeSubscriptionId },
      select: { organizationId: true },
    });
    if (sub) return sub.organizationId;
  }
  if (opts.stripeCustomerId) {
    const sub = await prisma.subscription.findFirst({
      where: { stripeCustomerId: opts.stripeCustomerId },
      select: { organizationId: true },
    });
    if (sub) return sub.organizationId;
  }
  return null;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const ts = top ?? item?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const orgId = await resolveOrgId({
    metadataOrgId: sub.metadata?.organizationId,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
  });
  if (!orgId) {
    console.warn("Webhook: could not resolve org for subscription", sub.id);
    return;
  }

  const mapped = mapStripeStatus(sub.status);

  // If the subscription metadata names a plan, sync the planId too.
  let planId: number | undefined;
  const planCode = sub.metadata?.planCode;
  if (planCode) {
    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (plan) planId = plan.id;
  }

  await applySubscriptionStatus(orgId, {
    subscriptionStatus: mapped.subscriptionStatus,
    orgStatus: mapped.orgStatus,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    currentPeriodEnd: periodEnd(sub),
    planId,
  });
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { success: false, error: "Billing webhook not configured" },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ success: false, error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        if (cs.subscription) {
          const subId = typeof cs.subscription === "string" ? cs.subscription : cs.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          // Carry checkout metadata onto the subscription sync if missing.
          sub.metadata = {
            ...(sub.metadata ?? {}),
            organizationId:
              sub.metadata?.organizationId ||
              cs.metadata?.organizationId ||
              cs.client_reference_id ||
              "",
            planCode: sub.metadata?.planCode || cs.metadata?.planCode || "",
          };
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subField = (inv as unknown as { subscription?: string | { id: string } }).subscription;
        const subId = typeof subField === "string" ? subField : subField?.id;
        const orgId = await resolveOrgId({
          stripeSubscriptionId: subId,
          stripeCustomerId: typeof inv.customer === "string" ? inv.customer : inv.customer?.id,
        });
        if (orgId) {
          await applySubscriptionStatus(orgId, {
            subscriptionStatus: "past_due",
            orgStatus: "suspended",
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`Error handling webhook ${event.type}:`, err);
    return NextResponse.json({ success: false, error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
