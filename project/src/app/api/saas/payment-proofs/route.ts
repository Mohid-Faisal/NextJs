import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

export const dynamic = 'force-dynamic';

/**
 * GET /api/saas/payment-proofs
 * Super-admin only. Lists all submitted manual payment proofs.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  try {
    const proofs = await prisma.paymentProof.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, status: true },
        },
        plan: {
          select: { id: true, name: true, code: true, priceMonthlyUsd: true },
        },
      },
    });

    return NextResponse.json({ success: true, proofs });
  } catch (error) {
    console.error("Error listing payment proofs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list payment proofs" },
      { status: 500 }
    );
  }
}
