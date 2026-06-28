import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/plans
 * Public — used by the org signup page to render plan choices.
 */
export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { priceMonthlyUsd: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        priceMonthlyUsd: true,
        maxUsers: true,
        maxShipmentsPerMonth: true,
        features: true,
      },
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
