import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

/**
 * GET /api/saas/organizations
 * Super-admin only. Lists every organization on the platform with member
 * count, plan/subscription status, and shipment volume.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  try {
    const organizations = await prisma.organization.findMany({
      where: {
        NOT: {
          id: 1 // Exclude super admin/default organization
        }
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        currency: true,
        createdAt: true,
        _count: { select: { members: true } },
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            plan: { select: { code: true, name: true } },
          },
        },
      },
    });

    // Shipment counts per org in a single grouped query.
    const shipmentCounts = await prisma.shipment.groupBy({
      by: ["organizationId"],
      _count: { _all: true },
    });
    const shipmentCountByOrg = new Map<number, number>(
      shipmentCounts.map((row) => [row.organizationId, row._count._all])
    );

    const data = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      currency: org.currency,
      createdAt: org.createdAt,
      memberCount: org._count.members,
      shipmentCount: shipmentCountByOrg.get(org.id) ?? 0,
      plan: org.subscription?.plan
        ? { code: org.subscription.plan.code, name: org.subscription.plan.name }
        : null,
      subscriptionStatus: org.subscription?.status ?? null,
      currentPeriodEnd: org.subscription?.currentPeriodEnd ?? null,
    }));

    // Calculate real stats from database
    const now = new Date();
    const monthsArray = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const year = d.getFullYear();
      const month = d.getMonth();
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
      monthsArray.push({
        label,
        start: startOfMonth,
        end: endOfMonth,
        revenue: 0,
      });
    }

    // Fetch approved payment proofs
    const approvedProofs = await prisma.paymentProof.findMany({
      where: {
        status: "approved",
      },
      include: {
        organization: { select: { name: true } },
        plan: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Populate chart data
    for (const proof of approvedProofs) {
      const proofTime = proof.createdAt.getTime();
      for (const m of monthsArray) {
        if (proofTime >= m.start.getTime() && proofTime <= m.end.getTime()) {
          m.revenue += proof.amount;
          break;
        }
      }
    }

    const chartData = monthsArray.map((m) => ({
      name: m.label,
      revenue: m.revenue,
    }));

    // Calculate revenue this month and this year
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);

    const revenueThisMonth = approvedProofs
      .filter((p) => p.createdAt >= startOfCurrentMonth)
      .reduce((sum, p) => sum + p.amount, 0);

    const revenueThisYear = approvedProofs
      .filter((p) => p.createdAt >= startOfCurrentYear)
      .reduce((sum, p) => sum + p.amount, 0);

    // Get latest transactions (approved payment proofs)
    const transactions = approvedProofs.slice(0, 5).map((p) => ({
      id: p.id,
      organizationName: p.organization.name,
      planName: p.plan.name,
      amount: p.amount,
      createdAt: p.createdAt.toISOString(),
    }));

    const activeSubsCount = data.filter(
      (org) => org.status === "active" || org.status === "trial"
    ).length;

    const gracePeriodCount = data.filter(
      (org) =>
        org.subscriptionStatus?.toLowerCase() === "grace" ||
        org.subscriptionStatus?.toLowerCase() === "past_due" ||
        org.subscriptionStatus?.toLowerCase() === "grace_period"
    ).length;

    const noSubCount = data.filter((org) => !org.plan).length;
    const readOnlyCount = data.filter((org) => org.status === "suspended").length;

    const stats = {
      revenueThisMonth,
      revenueThisYear,
      activeSubsCount,
      gracePeriodCount,
      readOnlyCount,
      noSubCount,
      chartData,
      transactions,
    };

    return NextResponse.json({ success: true, organizations: data, stats });
  } catch (error) {
    console.error("Error listing organizations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list organizations" },
      { status: 500 }
    );
  }
}
