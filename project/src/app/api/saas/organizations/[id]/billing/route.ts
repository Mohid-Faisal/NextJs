import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

/**
 * POST /api/saas/organizations/[id]/billing
 * Super-admin only. Manual "mark paid" — activates the org's subscription for
 * a number of months (default 1) without Stripe. For Pakistan/manual payments.
 * Optional body: { months?: number, planCode?: string }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId)) {
      return NextResponse.json({ success: false, error: "Invalid organization ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const months = Number.isFinite(body?.months) && body.months > 0 ? Math.floor(body.months) : 1;
    const planCode = typeof body?.planCode === "string" ? body.planCode.trim() : "";

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, subscription: { select: { id: true } } },
    });
    if (!org) {
      return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
    }

    let planId: number | undefined;
    if (planCode) {
      const plan = await prisma.plan.findUnique({ where: { code: planCode } });
      if (!plan) {
        return NextResponse.json({ success: false, error: "Unknown plan" }, { status: 400 });
      }
      planId = plan.id;
    }

    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + months);

    if (org.subscription) {
      await prisma.subscription.update({
        where: { organizationId: orgId },
        data: {
          status: "active",
          currentPeriodEnd,
          ...(planId !== undefined ? { planId } : {}),
        },
      });
    } else {
      // No subscription yet (edge case) — create one. Needs a plan.
      const fallback =
        planId !== undefined
          ? planId
          : (await prisma.plan.findFirst({ orderBy: { priceMonthlyUsd: "asc" } }))?.id;
      if (!fallback) {
        return NextResponse.json(
          { success: false, error: "No plans configured" },
          { status: 400 }
        );
      }
      await prisma.subscription.create({
        data: { organizationId: orgId, planId: fallback, status: "active", currentPeriodEnd },
      });
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { status: "active" },
      select: {
        id: true,
        name: true,
        status: true,
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            plan: { select: { code: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, organization: updated });
  } catch (error) {
    console.error("Error marking organization paid:", error);
    return NextResponse.json({ success: false, error: "Failed to mark paid" }, { status: 500 });
  }
}
