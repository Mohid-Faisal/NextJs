import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

const MANAGE_ROLES = ["OWNER", "ADMIN"];
const ASSIGNABLE_ROLES = ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT"];

async function loadMember(memberId: number, organizationId: number) {
  return prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, role: true, userId: true },
  });
}

async function ownerCount(organizationId: number) {
  return prisma.organizationMember.count({ where: { organizationId, role: "OWNER" } });
}

/** PATCH /api/org/members/[id] — change a member's role. OWNER/ADMIN only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  if (!MANAGE_ROLES.includes(session.orgRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const memberId = parseInt(id, 10);
    if (isNaN(memberId)) {
      return NextResponse.json({ success: false, error: "Invalid member ID" }, { status: 400 });
    }

    const body = await req.json();
    const role = typeof body.role === "string" ? body.role.trim().toUpperCase() : "";
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    const member = await loadMember(memberId, session.organizationId);
    if (!member) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
    }

    // Don't allow demoting the last remaining OWNER.
    if (member.role === "OWNER" && role !== "OWNER") {
      const owners = await ownerCount(session.organizationId);
      if (owners <= 1) {
        return NextResponse.json(
          { success: false, error: "Cannot change the role of the only owner." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
      select: { id: true, role: true, userId: true },
    });

    return NextResponse.json({ success: true, member: updated });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json({ success: false, error: "Failed to update member" }, { status: 500 });
  }
}

/** DELETE /api/org/members/[id] — remove a member. OWNER/ADMIN only. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  if (!MANAGE_ROLES.includes(session.orgRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const memberId = parseInt(id, 10);
    if (isNaN(memberId)) {
      return NextResponse.json({ success: false, error: "Invalid member ID" }, { status: 400 });
    }

    const member = await loadMember(memberId, session.organizationId);
    if (!member) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
    }

    // Don't allow removing the last remaining OWNER.
    if (member.role === "OWNER") {
      const owners = await ownerCount(session.organizationId);
      if (owners <= 1) {
        return NextResponse.json(
          { success: false, error: "Cannot remove the only owner." },
          { status: 400 }
        );
      }
    }

    await prisma.organizationMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ success: false, error: "Failed to remove member" }, { status: 500 });
  }
}
