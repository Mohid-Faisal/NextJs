import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { getOrgPlan, getOrgUsage, DEFAULT_ORG_ID } from "@/lib/billing/usage";

/**
 * GET /api/org/usage
 * Current org's plan limits + this-month usage. Used by the billing page and
 * any upgrade prompts. Available to any authenticated member.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const [plan, usage, officesCount, agenciesCount] = await Promise.all([
      getOrgPlan(session.organizationId),
      getOrgUsage(session.organizationId),
      prisma.office.count({ where: { organizationId: session.organizationId } }),
      prisma.agency.count({ where: { organizationId: session.organizationId } }),
    ]);

    const unlimited =
      session.organizationId === DEFAULT_ORG_ID ||
      !plan ||
      plan.features.unlimited === true ||
      plan.maxShipmentsPerMonth <= 0;

    const branchesUsed = officesCount + agenciesCount;
    let maxBranches = -1;
    if (plan && session.organizationId !== DEFAULT_ORG_ID) {
      const mb = typeof plan.features.maxBranches === 'number'
        ? plan.features.maxBranches
        : (plan.features.maxBranches ? parseInt(plan.features.maxBranches as string, 10) : 0);
      if (mb > 0) {
        maxBranches = mb;
      } else {
        // Fallback default mapping by plan code
        if (plan.code === "starter") maxBranches = 1;
        else if (plan.code === "growth" || plan.code === "basic") maxBranches = 3;
        else maxBranches = 5;
      }
    }

    return NextResponse.json({
      success: true,
      usage: {
        shipmentsThisMonth: usage.shipmentsThisMonth,
        maxShipmentsPerMonth: unlimited ? -1 : plan!.maxShipmentsPerMonth,
        members: usage.members,
        maxUsers: !plan || plan.maxUsers <= 0 ? -1 : plan.maxUsers,
        branches: branchesUsed,
        maxBranches,
      },
      plan: plan
        ? {
            code: plan.code,
            name: plan.name,
            maxShipmentsPerMonth: plan.maxShipmentsPerMonth,
            maxUsers: plan.maxUsers,
            features: plan.features,
            subscriptionStatus: plan.subscriptionStatus,
            trialEndsAt: plan.trialEndsAt,
          }
        : null,
      role: session.orgRole,
    });
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch usage" }, { status: 500 });
  }
}
