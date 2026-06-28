import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

const MANAGE_ROLES = ["OWNER", "ADMIN"];
export const ASSIGNABLE_ROLES = ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT"];

/** GET /api/org/members — list members of the current org. */
export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });

    const data = members.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      userStatus: m.user.status,
      isSelf: m.user.id === session.userId,
    }));

    return NextResponse.json({ success: true, members: data, role: session.orgRole });
  } catch (error) {
    console.error("Error listing members:", error);
    return NextResponse.json({ success: false, error: "Failed to list members" }, { status: 500 });
  }
}

/**
 * POST /api/org/members — add an existing user to the org by email.
 * OWNER/ADMIN only. The invited user must already have an account.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  if (!MANAGE_ROLES.includes(session.orgRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role.trim().toUpperCase() : "STAFF";

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "No account found with that email. Ask them to sign up first." },
        { status: 404 }
      );
    }

    const existing = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: session.organizationId, userId: user.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "This user is already a member of the organization." },
        { status: 409 }
      );
    }

    const member = await prisma.organizationMember.create({
      data: { organizationId: session.organizationId, userId: user.id, role },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        role: member.role,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        userStatus: member.user.status,
        isSelf: member.user.id === session.userId,
      },
    });
  } catch (error) {
    console.error("Error adding member:", error);
    return NextResponse.json({ success: false, error: "Failed to add member" }, { status: 500 });
  }
}
