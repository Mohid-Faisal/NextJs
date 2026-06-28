import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

/**
 * GET /api/saas/pending-approvals
 * Super-admin only. Lists users awaiting approval across all orgs, with the
 * organization(s) they belong to so the approver has context.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  try {
    const users = await prisma.user.findMany({
      where: {
        isApproved: false,
        OR: [{ status: "PENDING_APPROVAL" }, { status: "PENDING" }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true, slug: true, status: true } },
          },
        },
      },
    });

    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status.startsWith("PENDING_VERIFICATION_") ? "PENDING_VERIFICATION" : u.status,
      createdAt: u.createdAt,
      organizations: u.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        status: m.organization.status,
        role: m.role,
      })),
    }));

    return NextResponse.json({ success: true, users: data });
  } catch (error) {
    console.error("Error listing pending approvals:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list pending approvals" },
      { status: 500 }
    );
  }
}
