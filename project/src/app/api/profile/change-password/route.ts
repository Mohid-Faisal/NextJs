import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendPassword2FACodeEmail } from "@/lib/email";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit";
import { randomInt } from "node:crypto";

/**
 * SECURITY hardening vs. previous version:
 *  - Identity comes from the validated session (httpOnly cookie or Bearer),
 *    not a separately-required raw Bearer decode.
 *  - 2FA code verification is rate limited per account (was unlimited →
 *    6-digit code was brute-forceable within the 10-minute window).
 *  - New password must satisfy minimum strength requirements.
 */

function validateNewPassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate Session
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await request.json();
    const { action, currentPassword, newPassword, code } = body;

    // Retrieve user from DB
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
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

      // Per-account throttle on code issuance.
      const sendLimit = rateLimit(`pwchange-send:${user.id}`, 3, 10 * 60 * 1000);
      if (!sendLimit.allowed) return rateLimitResponse(sendLimit);

      // Verify current password
      const passwordMatch = await bcrypt.compare(String(currentPassword), user.password);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: "Incorrect current password" },
          { status: 401 }
        );
      }

      // Generate 6-digit code
      const verificationCode = randomInt(100000, 1000000).toString();

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

      const passwordError = validateNewPassword(String(newPassword));
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 });
      }

      // Check user status
      if (!user.status || !user.status.startsWith("PENDING_2FA_")) {
        return NextResponse.json(
          { error: "No pending 2FA request found. Please request a code first." },
          { status: 400 }
        );
      }

      // Brute-force guard: max 6 code attempts per account.
      const codeLimit = rateLimit(`pwchange-code:${user.id}`, 6, 10 * 60 * 1000);
      if (!codeLimit.allowed) return rateLimitResponse(codeLimit);

      const parts = user.status.split("_");
      const savedCode = parts[2];
      const savedTime = parseInt(parts[3]);

      // Check code match
      if (savedCode !== String(code).trim()) {
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
      const hashedPassword = await bcrypt.hash(newPassword, 12);

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
