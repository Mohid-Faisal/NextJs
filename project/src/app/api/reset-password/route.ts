import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { sendPasswordResetCodeEmail } from "@/lib/email";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit";
import { randomInt } from "node:crypto";

/**
 * Password reset — two-step, verification-code based.
 *
 * SECURITY: The previous implementation reset any account's password with
 * nothing but the email address (full platform takeover). Now:
 *   POST { email }                → emails a 6-digit code (uniform response,
 *                                   no account enumeration)
 *   PATCH { email, code, password } → resets only with a valid, unexpired code
 */

const CODE_TTL_MS = 10 * 60 * 1000;

function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
}

/** Step 1: request a reset code. Always returns success (anti-enumeration). */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipLimit = rateLimit(`pwreset:ip:${ip}`, 5, 60 * 60 * 1000);
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit);

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailLimit = rateLimit(`pwreset:email:${normalizedEmail}`, 3, 60 * 60 * 1000);
    if (!emailLimit.allowed) return rateLimitResponse(emailLimit);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const code = randomInt(100000, 1000000).toString();
      const status = `PENDING_PASSWORD_RESET_${code}_${Date.now() + CODE_TTL_MS}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { status },
      });

      try {
        await sendPasswordResetCodeEmail(user.email, user.name, code);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        await prisma.user.update({
          where: { id: user.id },
          data: { status: "ACTIVE" },
        });
      }
    }

    // Uniform response whether or not the account exists.
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a reset code has been sent.",
    });
  } catch (error) {
    console.error("Reset password request error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to process reset request." },
      { status: 500 }
    );
  }
}

/** Step 2: verify code and set the new password. */
export async function PATCH(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const confirmLimit = rateLimit(`pwreset-confirm:ip:${ip}`, 10, 60 * 60 * 1000);
    if (!confirmLimit.allowed) return rateLimitResponse(confirmLimit);

    const { email, code, password } = await req.json();
    if (!email || !code || !password) {
      return NextResponse.json(
        { success: false, message: "Email, verification code and new password are required." },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(String(password));
    if (passwordError) {
      return NextResponse.json(
        { success: false, message: passwordError },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.status?.startsWith("PENDING_PASSWORD_RESET_")) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired reset code." },
        { status: 400 }
      );
    }

    // Brute-force guard per account: 6 attempts per code window.
    const codeLimit = rateLimit(`pwreset-code:${user.id}`, 6, CODE_TTL_MS);
    if (!codeLimit.allowed) return rateLimitResponse(codeLimit);

    const parts = user.status.split("_");
    // PENDING_PASSWORD_RESET_<code>_<expiry> → split gives 5 parts
    const storedCode = parts[3];
    const expiry = parseInt(parts[4], 10);

    if (!storedCode || storedCode !== String(code).trim()) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired reset code." },
        { status: 400 }
      );
    }

    if (Date.now() > expiry) {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE" },
      });
      return NextResponse.json(
        { success: false, message: "Reset code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, status: "ACTIVE" },
    });

    return NextResponse.json({ success: true, message: "Password reset successful." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to reset password." },
      { status: 500 }
    );
  }
}
