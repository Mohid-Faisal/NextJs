import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

/**
 * GET /api/plans
 * Public — used by the org signup page to render plan choices.
 */
export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { priceMonthlyUsd: "asc" },
      include: {
        _count: {
          select: { subscriptions: true }
        }
      }
    });
    return NextResponse.json({ success: true, plans });
  } catch (error) {
    console.error("Error listing plans:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list plans" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plans
 * Super-admin only. Creates a new subscription plan.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { code, name, priceMonthlyUsd, maxUsers, maxShipmentsPerMonth, features } = body;

    if (!code?.trim() || !name?.trim() || priceMonthlyUsd === undefined || maxUsers === undefined || maxShipmentsPerMonth === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: code, name, priceMonthlyUsd, maxUsers, maxShipmentsPerMonth" },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toLowerCase();
    const existing = await prisma.plan.findUnique({
      where: { code: cleanCode }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A plan with code "${cleanCode}" already exists.` },
        { status: 409 }
      );
    }

    const plan = await prisma.plan.create({
      data: {
        code: cleanCode,
        name: name.trim(),
        priceMonthlyUsd: parseFloat(priceMonthlyUsd),
        maxUsers: parseInt(maxUsers, 10),
        maxShipmentsPerMonth: parseInt(maxShipmentsPerMonth, 10),
        features: features || {},
      }
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("Error creating plan:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create plan" },
      { status: 500 }
    );
  }
}

