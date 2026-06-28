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
