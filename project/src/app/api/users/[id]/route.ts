import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

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

    // Delete user
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
