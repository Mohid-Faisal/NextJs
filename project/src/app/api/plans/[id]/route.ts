import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/plans/[id]
 * Returns details of a specific plan.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const planId = parseInt(id, 10);
    if (isNaN(planId)) {
      return NextResponse.json({ success: false, error: "Invalid plan ID" }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: { subscriptions: true }
        }
      }
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("Error fetching plan:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch plan" }, { status: 500 });
  }
}

/**
 * PUT /api/plans/[id]
 * Super-admin only. Updates a plan's details.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const planId = parseInt(id, 10);
    if (isNaN(planId)) {
      return NextResponse.json({ success: false, error: "Invalid plan ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, priceMonthlyUsd, maxUsers, maxShipmentsPerMonth, features } = body;

    const existing = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    // Merge or set features
    const updatedFeatures = {
      ...(existing.features as Record<string, any> || {}),
      ...(features || {})
    };

    const plan = await prisma.plan.update({
      where: { id: planId },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        priceMonthlyUsd: priceMonthlyUsd !== undefined ? parseFloat(priceMonthlyUsd) : existing.priceMonthlyUsd,
        maxUsers: maxUsers !== undefined ? parseInt(maxUsers, 10) : existing.maxUsers,
        maxShipmentsPerMonth: maxShipmentsPerMonth !== undefined ? parseInt(maxShipmentsPerMonth, 10) : existing.maxShipmentsPerMonth,
        features: updatedFeatures,
      }
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("Error updating plan:", error);
    return NextResponse.json({ success: false, error: "Failed to update plan" }, { status: 500 });
  }
}

/**
 * DELETE /api/plans/[id]
 * Super-admin only. Deletes a plan if it has no subscriptions, or deactivates it (isActive = false).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const planId = parseInt(id, 10);
    if (isNaN(planId)) {
      return NextResponse.json({ success: false, error: "Invalid plan ID" }, { status: 400 });
    }

    const existing = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: { subscriptions: true }
        }
      }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    // If it has active subscriptions, we cannot hard delete it. We deactivate it instead.
    if (existing._count.subscriptions > 0) {
      const features = (existing.features as Record<string, any>) || {};
      features.isActive = false;

      const plan = await prisma.plan.update({
        where: { id: planId },
        data: { features }
      });

      return NextResponse.json({
        success: true,
        message: "Plan has active subscriptions. It was deactivated instead of deleted.",
        plan
      });
    }

    // Otherwise, we delete it from the database
    await prisma.plan.delete({
      where: { id: planId }
    });

    return NextResponse.json({ success: true, message: "Plan deleted successfully" });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return NextResponse.json({ success: false, error: "Failed to delete plan" }, { status: 500 });
  }
}
