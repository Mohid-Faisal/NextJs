import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { sendUserApprovalEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User already exists." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with pending approval
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "USER", // Default role for new signups
        status: "PENDING",
        isApproved: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isApproved: true,
        createdAt: true,
      }
    });

    // Send approval email to admin
    try {
      const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/users/approve/${user.id}`;
      await sendUserApprovalEmail({
        userName: user.name,
        userEmail: user.email,
        approvalUrl,
      });
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail user creation if email fails
    }

    return NextResponse.json({ 
      success: true, 
      message: "Account created successfully! Please wait for admin approval before logging in.",
      user 
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, message: "Signup failed." },
      { status: 500 }
    );
  }
}
