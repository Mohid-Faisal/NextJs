import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

/**
 * PATCH /api/saas/payment-proofs/[id]
 * Super-admin only. Approves or rejects a manual payment proof.
 * Body: { status: "approved" | "rejected", months?: number, notes?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const proofId = parseInt(id, 10);
    if (isNaN(proofId)) {
      return NextResponse.json({ success: false, error: "Invalid payment proof ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { status, months = 1, notes = "" } = body;

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json(
        { success: false, error: "Status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const proof = await prisma.paymentProof.findUnique({
      where: { id: proofId },
      include: {
        organization: { select: { id: true, status: true, subscription: { select: { id: true, currentPeriodEnd: true } } } },
        plan: true,
      },
    });

    if (!proof) {
      return NextResponse.json({ success: false, error: "Payment proof not found" }, { status: 404 });
    }

    if (proof.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `This payment proof is already ${proof.status}` },
        { status: 400 }
      );
    }

    if (status === "approved") {
      const activeMonths = Number.isFinite(months) && months > 0 ? Math.floor(months) : 1;

      // Calculate new period end date
      const baseDate =
        proof.organization.subscription?.currentPeriodEnd &&
        proof.organization.subscription.currentPeriodEnd.getTime() > Date.now()
          ? new Date(proof.organization.subscription.currentPeriodEnd)
          : new Date();

      const newPeriodEnd = new Date(baseDate);
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + activeMonths);

      // 1. Update the subscription
      if (proof.organization.subscription) {
        await prisma.subscription.update({
          where: { organizationId: proof.organizationId },
          data: {
            status: "active",
            currentPeriodEnd: newPeriodEnd,
            planId: proof.planId,
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            organizationId: proof.organizationId,
            planId: proof.planId,
            status: "active",
            currentPeriodEnd: newPeriodEnd,
          },
        });
      }

      // 2. Activate organization status
      await prisma.organization.update({
        where: { id: proof.organizationId },
        data: { status: "active" },
      });
    }

    // Update proof status
    const updatedProof = await prisma.paymentProof.update({
      where: { id: proofId },
      data: {
        status,
        notes: notes || null,
      },
      include: {
        organization: { select: { name: true } },
        plan: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, proof: updatedProof });
  } catch (error) {
    console.error("Error updating payment proof:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update payment proof" },
      { status: 500 }
    );
  }
}
