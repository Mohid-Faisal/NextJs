import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { resolveMembership } from "@/lib/auth/membership";
import { createSession } from "@/lib/auth/session";
import { attachSessionCookie } from "@/lib/auth/cookies";
import { ensureDemoAccountExists, DEMO_EMAIL } from "@/lib/auth/demoAccount";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit";
import { audit } from "@/lib/audit";
import { sendNewDeviceLoginAlertEmail } from "@/lib/email";

// Uniform error message — never reveal whether an email exists or its state.
const INVALID_CREDENTIALS = "Invalid email or password.";

/**
 * Valid bcrypt-format hash of an unguessable random value. Compared against
 * when the email does not exist so response timing stays comparable and no
 * error-path difference reveals account existence.
 */
const DUMMY_HASH = "$2a$12$RI8voG1BmFtHGW9VpQTDGOQwLPIyT8Qo0v8Sf9RKWdOnMKWDgbk7O";

export async function POST(req: Request) {
  try {
    // Brute-force protection: per-IP and per-email limits.
    const ip = getClientIp(req);
    const ipLimit = rateLimit(`login:ip:${ip}`, 10, 5 * 60 * 1000);
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit);

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const emailLimit = rateLimit(`login:email:${normalizedEmail}`, 5, 5 * 60 * 1000);
    if (!emailLimit.allowed) return rateLimitResponse(emailLimit);

    // Auto-provision demo account if logging in with DEMO_EMAIL
    if (normalizedEmail === DEMO_EMAIL.toLowerCase()) {
      await ensureDemoAccountExists();
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Verify the password FIRST and return a uniform message so attackers
    // cannot enumerate emails or probe account approval/status states.
    let passwordMatch = false;
    if (user) {
      passwordMatch = await bcrypt.compare(String(password), user.password);
    } else {
      try {
        await bcrypt.compare(String(password), DUMMY_HASH);
      } catch {
        // ignore — treated as failed match
      }
    }

    if (!user || !passwordMatch) {
      await audit(null, req, "login.failure", "User", null, {
        email: normalizedEmail,
      });
      return NextResponse.json(
        { success: false, message: INVALID_CREDENTIALS },
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
    const allowedPending =
      userStatus.startsWith("PENDING_2FA_") ||
      userStatus.startsWith("PENDING_PASSWORD_RESET_");
    if (userStatus !== "ACTIVE" && !allowedPending) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is not active. Please contact an administrator.",
        },
        { status: 403 }
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

    // Create a server-side session (revocable) bound to the JWT via `sid`.
    const { token } = await createSession(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        organizationId: membership.organizationId,
        orgRole: membership.orgRole,
        orgStatus: membership.orgStatus,
        platformRole: user.platformRole,
      },
      {
        ip: ip === "unknown" ? null : ip,
        userAgent: req.headers.get("user-agent"),
      }
    );

    // Security alert: sign-in from an IP this account has never used before.
    try {
      const currentIp = ip === "unknown" ? null : ip;
      const priorSessions = await prisma.authSession.findMany({
        where: { userId: user.id, ipAddress: { not: null } },
        select: { ipAddress: true },
        take: 100,
        orderBy: { createdAt: "desc" },
      });
      const seenIps = new Set(priorSessions.map((s) => s.ipAddress));
      if (currentIp && seenIps.size > 0 && !seenIps.has(currentIp)) {
        await sendNewDeviceLoginAlertEmail(
          user.email,
          user.name,
          currentIp,
          req.headers.get("user-agent"),
          new Date()
        );
      }
    } catch (alertErr) {
      console.error("Login alert check failed:", alertErr);
    }

    // Token is delivered as an httpOnly cookie — never in the response body.
    const res = NextResponse.json({
      success: true,
      message: "Login successful!",
      organization: {
        id: membership.organizationId,
        name: membership.orgName,
        slug: membership.orgSlug,
        role: membership.orgRole,
        status: membership.orgStatus,
      },
    });
    await audit(
      { userId: user.id, email: user.email, organizationId: membership.organizationId },
      req,
      "login.success",
      "User",
      user.id
    );
    return attachSessionCookie(res, token);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
