import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { getStripe, resolvePriceId } from "@/lib/billing/stripe";

const MANAGE_ROLES = ["OWNER", "ADMIN"];

/**
 * POST /api/billing/checkout
 * OWNER/ADMIN only. Creates a Stripe Checkout session to subscribe the current
 * org to the requested plan, and returns the redirect URL.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  if (!MANAGE_ROLES.includes(session.orgRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { success: false, error: "Billing is not configured. Set STRIPE_SECRET_KEY." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const planCode = String(body?.planCode || "").trim();
    if (!planCode) {
      return NextResponse.json({ success: false, error: "planCode is required" }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) {
      return NextResponse.json({ success: false, error: "Unknown plan" }, { status: 404 });
    }

    const features = (plan.features ?? {}) as { stripePriceId?: string };
    const priceId = resolvePriceId(plan.code, features.stripePriceId);
    if (!priceId) {
      return NextResponse.json(
        {
          success: false,
          error: `No Stripe price configured for plan "${plan.code}". Set features.stripePriceId or STRIPE_PRICE_${plan.code.toUpperCase()}.`,
        },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        name: true,
        subscription: { select: { stripeCustomerId: true } },
      },
    });

    // Reuse a Stripe customer if we have one, else create one tied to the org.
    let customerId = org?.subscription?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.email,
        name: org?.name ?? session.email,
        metadata: { organizationId: String(session.organizationId) },
      });
      customerId = customer.id;
      await prisma.subscription.update({
        where: { organizationId: session.organizationId },
        data: { stripeCustomerId: customerId },
      });
    }

    const origin = req.nextUrl.origin;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/settings/billing?checkout=success`,
      cancel_url: `${origin}/dashboard/settings/billing?checkout=cancelled`,
      client_reference_id: String(session.organizationId),
      subscription_data: {
        metadata: { organizationId: String(session.organizationId), planCode: plan.code },
      },
      metadata: { organizationId: String(session.organizationId), planCode: plan.code },
    });

    return NextResponse.json({ success: true, url: checkout.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start checkout" },
      { status: 500 }
    );
  }
}
