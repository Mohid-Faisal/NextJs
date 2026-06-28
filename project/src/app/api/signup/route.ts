import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";
import { createOrganizationForSignup } from "@/lib/auth/membership";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, companyName, planCode } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { success: false, message: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User with this email already exists" },
        { status: 400 }
      );
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        status: `PENDING_VERIFICATION_${verificationCode}_${Date.now() + 10 * 60 * 1000}`,
        isApproved: false,
      },
    });

    let organization: { id: number; slug: string } | null = null;
    if (companyName?.trim()) {
      try {
        organization = await createOrganizationForSignup(
          companyName.trim(),
          user.id,
          typeof planCode === "string" && planCode.trim() ? planCode.trim() : "starter"
        );
      } catch (orgError) {
        await prisma.user.delete({ where: { id: user.id } });
        console.error("Org creation failed during signup:", orgError);
        return NextResponse.json(
          { success: false, message: "Could not create organization. Try a different company name." },
          { status: 400 }
        );
      }
    }

    const emailSent = await sendVerificationEmail(email, name, verificationCode);

    if (!emailSent) {
      await prisma.organizationMember.deleteMany({ where: { userId: user.id } });
      if (organization) {
        await prisma.subscription.deleteMany({ where: { organizationId: organization.id } });
        await prisma.organization.delete({ where: { id: organization.id } });
      }
      await prisma.user.delete({ where: { id: user.id } });
      return NextResponse.json(
        { success: false, message: "Failed to send verification email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Verification code sent to your email. Please check your inbox and enter the 6-digit code.",
      userId: user.id,
      organization,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
