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
    }));

    return NextResponse.json({ success: true, organizations: data });
  } catch (error) {
    console.error("Error listing organizations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list organizations" },
      { status: 500 }
    );
  }
}
