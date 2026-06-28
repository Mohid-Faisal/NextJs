import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

/**
 * DELETE /api/saas/pending-approvals/[id]
 * Super-admin only. Rejects a pending signup by deleting the user account.
 * If the user is the sole member of a brand-new trial org, that org (and its
 * trial subscription) is cleaned up too so we don't leave orphaned workspaces.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;
  const approver = auth.session;

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: "Invalid user ID" }, { status: 400 });
    }

    if (userId === approver.userId) {
      return NextResponse.json(
        { success: false, error: "You cannot reject your own account." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isApproved: true,
        memberships: { select: { organizationId: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }
    if (user.isApproved) {
      return NextResponse.json(
        { success: false, error: "This account is already approved and cannot be rejected here." },
        { status: 400 }
      );
    }

    // Clean up brand-new trial orgs the user is the only member of.
    for (const m of user.memberships) {
      const [memberCount, org] = await Promise.all([
        prisma.organizationMember.count({ where: { organizationId: m.organizationId } }),
        prisma.organization.findUnique({
          where: { id: m.organizationId },
          select: { id: true, status: true },
        }),
      ]);

      if (memberCount === 1 && org && org.status === "trial") {
        const shipmentCount = await prisma.shipment.count({
          where: { organizationId: m.organizationId },
        });
        if (shipmentCount === 0) {
          // Cascades to subscription + membership (relationMode = prisma).
          await prisma.organization.delete({ where: { id: m.organizationId } });
        }
      }
    }

    // Deleting the user cascades any remaining memberships.
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting pending user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reject account" },
      { status: 500 }
    );
  }
}
