import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendPassword2FACodeEmail } from "@/lib/email";
import { requireApiSession } from "@/lib/auth/requireApiSession";

function decodeToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET || "your-secret-key";
    return jwt.verify(token, secret) as { id: string; [key: string]: unknown };
  } catch (error) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate Session
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    // Get auth token from headers
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = decodeToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, currentPassword, newPassword, code } = body;

    // Retrieve user from DB
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.id) },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Step 1: Send 2FA verification email
    if (action === "send-2fa") {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 }
        );
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: "Incorrect current password" },
          { status: 401 }
        );
      }

      // Generate 6-digit code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Store temporarily in user status
      const tempStatus = `PENDING_2FA_${verificationCode}_${Date.now()}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { status: tempStatus },
      });

      try {
        await sendPassword2FACodeEmail(user.email, user.name, verificationCode);
        return NextResponse.json({
          success: true,
          message: "Verification code sent to your email.",
        });
      } catch (err) {
        // Revert status
        await prisma.user.update({
          where: { id: user.id },
          data: { status: "ACTIVE" },
        });
        return NextResponse.json(
          { error: "Failed to send email. Please try again." },
          { status: 500 }
        );
      }
    }

    // Step 2: Verify 2FA and change password
    if (action === "change-password") {
      if (!newPassword || !code) {
        return NextResponse.json(
          { error: "New password and verification code are required" },
          { status: 400 }
        );
      }

      // Check user status
      if (!user.status || !user.status.startsWith("PENDING_2FA_")) {
        return NextResponse.json(
          { error: "No pending 2FA request found. Please request a code first." },
          { status: 400 }
        );
      }

      const parts = user.status.split("_");
      const savedCode = parts[2];
      const savedTime = parseInt(parts[3]);

      // Check code match
      if (savedCode !== code) {
        return NextResponse.json(
          { error: "Invalid verification code" },
          { status: 400 }
        );
      }

      // Check expiration (10 minutes)
      if (Date.now() - savedTime > 600000) {
        // Reset status
        await prisma.user.update({
          where: { id: user.id },
          data: { status: "ACTIVE" },
        });
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new one." },
          { status: 400 }
        );
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password & reset status to ACTIVE
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          status: "ACTIVE",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Password changed successfully",
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );

  } catch (error) {
    console.error("Error in change-password route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
