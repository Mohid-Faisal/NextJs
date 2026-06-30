import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        phone: true,
        address: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Resolve their membership role in this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.userId,
        organizationId: session.organizationId,
      },
      select: { role: true },
    });

    const orgRole = membership?.role || session.orgRole;

    return NextResponse.json({
      ...user,
      orgRole,
      isOwner: orgRole === "OWNER",
    });
  } catch (error) {
    console.error("Error fetching current user profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const body = await req.json();
    const { name, phone, address } = body;

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        phone: true,
        address: true,
      },
    });

    // Also resolve their membership role to return complete data
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.userId,
        organizationId: session.organizationId,
      },
      select: { role: true },
    });

    const orgRole = membership?.role || session.orgRole;

    return NextResponse.json({
      ...updatedUser,
      orgRole,
      isOwner: orgRole === "OWNER",
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
