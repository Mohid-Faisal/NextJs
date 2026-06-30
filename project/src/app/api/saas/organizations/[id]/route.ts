import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

const ALLOWED_STATUSES = ["active", "trial", "suspended"] as const;
type OrgStatus = (typeof ALLOWED_STATUSES)[number];

/**
 * PATCH /api/saas/organizations/[id]
 * Super-admin only. Updates an organization's status (active | trial | suspended).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId)) {
      return NextResponse.json(
        { success: false, error: "Invalid organization ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const status = body?.status as string | undefined;

    if (!status || !ALLOWED_STATUSES.includes(status as OrgStatus)) {
      return NextResponse.json(
        { success: false, error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Prevent the super admin from suspending the org they're currently
    // operating in (would lock themselves out of the dashboard).
    if (status === "suspended" && orgId === session.organizationId) {
      return NextResponse.json(
        { success: false, error: "You cannot suspend your own organization." },
        { status: 400 }
      );
    }

    const existing = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { status },
      select: { id: true, name: true, slug: true, status: true },
    });

    return NextResponse.json({ success: true, organization: updated });
  } catch (error) {
    console.error("Error updating organization status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update organization" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/saas/organizations/[id]
 * Super-admin only. Deletes an organization, its users, and all its associated data (2FA protected).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId)) {
      return NextResponse.json({ success: false, error: "Invalid organization ID" }, { status: 400 });
    }

    if (orgId === session.organizationId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You cannot delete your current organization." },
        { status: 400 }
      );
    }

    // Get the request body for password & verification code
    const body: { password?: string; verificationCode?: string } = await request.json().catch(() => ({}));
    const { password, verificationCode } = body;

    if (!password || !verificationCode) {
      return NextResponse.json(
        { success: false, error: "Password and 2FA verification code are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ success: false, error: "Incorrect password" }, { status: 401 });
    }

    // Verify 2FA code
    const userStatus = user.status?.toUpperCase() || "";
    if (userStatus.startsWith("PENDING_2FA_")) {
      const statusParts = user.status.split("_");
      const storedCode = statusParts[2];
      const timestamp = parseInt(statusParts[3]);
      const currentTime = Date.now();

      if (currentTime - timestamp > 10 * 60 * 1000) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: "ACTIVE" },
        });
        return NextResponse.json(
          { success: false, error: "Verification code has expired. Please request a new one." },
          { status: 400 }
        );
      }

      if (verificationCode !== storedCode) {
        return NextResponse.json(
          { success: false, error: "Invalid verification code" },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "No pending 2FA code found. Please request a code first." },
        { status: 400 }
      );
    }

    // Load org to verify existence
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
    }

    // Perform database cleanup in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Find all members of the organization
      const members = await tx.organizationMember.findMany({
        where: { organizationId: orgId },
        select: { userId: true },
      });
      const userIds = members.map((m) => m.userId);

      // 2. Delete invoice dependencies (debit and credit notes)
      const invoiceIds = (
        await tx.invoice.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        })
      ).map((inv) => inv.id);

      if (invoiceIds.length > 0) {
        await tx.debitNote.deleteMany({
          where: { billId: { in: invoiceIds } },
        });
        await tx.creditNote.deleteMany({
          where: { invoiceId: { in: invoiceIds } },
        });
      }

      // 3. Delete organization-specific records
      await tx.invoice.deleteMany({ where: { organizationId: orgId } });
      await tx.payment.deleteMany({ where: { organizationId: orgId } });
      await tx.customerTransaction.deleteMany({ where: { organizationId: orgId } });
      await tx.vendorTransaction.deleteMany({ where: { organizationId: orgId } });
      await tx.vendorservice.deleteMany({ where: { organizationId: orgId } });
      await tx.filename.deleteMany({ where: { organizationId: orgId } });
      await tx.rate.deleteMany({ where: { organizationId: orgId } });
      await tx.remoteArea.deleteMany({ where: { organizationId: orgId } });
      await tx.zoneUpload.deleteMany({ where: { organizationId: orgId } });
      await tx.zone.deleteMany({ where: { organizationId: orgId } });
      await tx.hsCode.deleteMany({ where: { organizationId: orgId } });
      await tx.serviceMode.deleteMany({ where: { organizationId: orgId } });
      await tx.packagingType.deleteMany({ where: { organizationId: orgId } });
      await tx.shippingMode.deleteMany({ where: { organizationId: orgId } });
      await tx.deliveryStatus.deleteMany({ where: { organizationId: orgId } });
      await tx.office.deleteMany({ where: { organizationId: orgId } });
      await tx.agency.deleteMany({ where: { organizationId: orgId } });
      await tx.branch.deleteMany({ where: { organizationId: orgId } });
      await tx.shipment.deleteMany({ where: { organizationId: orgId } });
      await tx.customers.deleteMany({ where: { organizationId: orgId } });
      await tx.vendors.deleteMany({ where: { organizationId: orgId } });
      await tx.recipients.deleteMany({ where: { organizationId: orgId } });
      await tx.fixedCharge.deleteMany({ where: { organizationId: orgId } });
      await tx.chartOfAccount.deleteMany({ where: { organizationId: orgId } });
      await tx.journalEntry.deleteMany({ where: { organizationId: orgId } });
      await tx.wallet.deleteMany({ where: { organizationId: orgId } });
      await tx.paymentProof.deleteMany({ where: { organizationId: orgId } });

      // 4. Delete memberships and subscription
      await tx.organizationMember.deleteMany({ where: { organizationId: orgId } });

      // 5. Delete organization
      await tx.organization.delete({ where: { id: orgId } });

      // 6. Delete users if they have no other organization memberships left
      for (const userId of userIds) {
        const otherMembershipsCount = await tx.organizationMember.count({
          where: { userId },
        });
        if (otherMembershipsCount === 0) {
          await tx.user.delete({ where: { id: userId } });
        }
      }
    });

    // Reset user 2FA status back to ACTIVE
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE" },
    });

    return NextResponse.json({ success: true, message: `Organization ${org.name} and all associated data deleted successfully.` });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete organization" },
      { status: 500 }
    );
  }
}
