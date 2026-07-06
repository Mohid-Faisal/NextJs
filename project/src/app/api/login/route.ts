import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { resolveMembership } from "@/lib/auth/membership";
import { signSessionToken } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 401 }
      );
    }

    if (!user.isApproved) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your account is pending approval. Please wait for an administrator to approve your account.",
        },
        { status: 403 }
      );
    }

    const userStatus = user.status?.toUpperCase() || "";
    if (userStatus !== "ACTIVE" && !userStatus.startsWith("PENDING_2FA_")) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is not active. Please contact an administrator.",
        },
        { status: 403 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, message: "Invalid credentials." },
        { status: 401 }
      );
    }

    // Record last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const membership = await resolveMembership(user.id);
    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          message: "No organization linked to this account. Contact support.",
        },
        { status: 403 }
      );
    }

    if (membership.orgStatus === "suspended") {
      return NextResponse.json(
        {
          success: false,
          message: "Your organization has been suspended. Contact support.",
        },
        { status: 403 }
      );
    }

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organizationId,
      orgRole: membership.orgRole,
      orgStatus: membership.orgStatus,
      platformRole: user.platformRole,
    });

    return NextResponse.json({
      success: true,
      message: "Login successful!",
      token,
      organization: {
        id: membership.organizationId,
        name: membership.orgName,
        slug: membership.orgSlug,
        role: membership.orgRole,
        status: membership.orgStatus,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
