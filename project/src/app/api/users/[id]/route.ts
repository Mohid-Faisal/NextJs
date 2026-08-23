import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(request);
  if (auth.error) return auth.error;
  const session = auth.session;

  const isSuperAdmin = session.platformRole === "SUPER_ADMIN";
  const isOrgOwner = session.orgRole === "OWNER";
  if (!isSuperAdmin && !isOrgOwner) {
    return NextResponse.json(
      { error: "Forbidden: Only Super Admins and Org Owners can access this resource" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const userId = parseInt(id);
    const body = await request.json();
    const { role, status, name, email } = body;

    if (userId === session.userId) {
      return NextResponse.json(
        { error: "Forbidden: You cannot edit your own account details or role here." },
        { status: 400 }
      );
    }

    // Validate user exists and belongs to the same organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        memberships: {
          some: {
            organizationId: session.organizationId
          }
        }
      }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found or not in your organization' },
        { status: 404 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role && { role }),
        ...(status && { status: status.toUpperCase() }),
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      }
    });

    // SECURITY: if an admin deactivates a user, kill their live sessions so
    // the ban takes effect immediately instead of waiting for token expiry.
    const newStatus = updatedUser.status?.toUpperCase() || "";
    if (newStatus !== "ACTIVE" && !newStatus.startsWith("PENDING_")) {
      await revokeAllUserSessions(userId);
      await audit(session, request, "user.deactivated", "User", userId, {
        status: newStatus,
      });
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(request);
  if (auth.error) return auth.error;
  const session = auth.session;

  const isSuperAdmin = session.platformRole === "SUPER_ADMIN";
  const isOrgOwner = session.orgRole === "OWNER";
  if (!isSuperAdmin && !isOrgOwner) {
    return NextResponse.json(
      { error: "Forbidden: Only Super Admins and Org Owners can access this resource" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (userId === session.userId) {
      return NextResponse.json(
        { error: "Forbidden: You cannot delete your own account." },
        { status: 400 }
      );
    }

    // Validate user exists and belongs to the same organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        memberships: {
          some: {
            organizationId: session.organizationId
          }
        }
      }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found or not in your organization' },
        { status: 404 }
      );
    }

    // SECURITY: org owners remove a user from THEIR organization only.
    // Platform-wide account deletion is reserved for super admins — deleting
    // the User row previously cascaded the user out of every organization.
    if (isSuperAdmin) {
      await revokeAllUserSessions(userId);
      await audit(session, request, "user.deleted", "User", userId, {
        email: existingUser.email,
      });
      await prisma.user.delete({
        where: { id: userId }
      });
      return NextResponse.json({ message: 'User deleted successfully' });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId: session.organizationId,
      },
    });
    if (!membership) {
      return NextResponse.json(
        { error: 'User is not a member of your organization' },
        { status: 404 }
      );
    }
    if (membership.role === "OWNER") {
      const owners = await prisma.organizationMember.count({
        where: { organizationId: session.organizationId, role: "OWNER" },
      });
      if (owners <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the only owner of the organization.' },
          { status: 400 }
        );
      }
    }

    await prisma.organizationMember.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ message: 'User removed from organization successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
