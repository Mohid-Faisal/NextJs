import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with pending verification status
    // Store verification data in status field temporarily
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        status: `PENDING_VERIFICATION_${verificationCode}_${Date.now() + 10 * 60 * 1000}`, // Store code and expiry in status
        isApproved: false,
      },
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(email, name, verificationCode);

    if (!emailSent) {
      // If email fails, delete the user and return error
      await prisma.user.delete({ where: { id: user.id } });
      return NextResponse.json(
        { success: false, message: "Failed to send verification email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email. Please check your inbox and enter the 6-digit code.",
      userId: user.id,
    });

  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
