import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * SECURITY hardening vs. previous version:
 *  - Full session validation (user status/approval/org checks) instead of a
 *    raw jwt.verify that accepted tokens of deleted/suspended users.
 *  - Recipients are restricted to members of the caller's organization
 *    (previously ANY platform user could be targeted — cross-tenant spam).
 *  - Only OWNER/ADMIN roles may send bulk email; per-IP rate limiting.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const privileged =
      session.platformRole === "SUPER_ADMIN" ||
      session.orgRole === "OWNER" ||
      session.orgRole === "ADMIN";

    if (!privileged) {
      return NextResponse.json(
        { error: "Forbidden: only organization admins can send emails." },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const limit = rateLimit(`email-send:${ip}:${session.organizationId}`, 30, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit);

    const { recipients, subject, body } = await req.json();

    // Validate required fields
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Recipients are required" }, { status: 400 });
    }

    if (recipients.length > 200) {
      return NextResponse.json({ error: "Too many recipients (max 200)" }, { status: 400 });
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    if (!body || !body.trim()) {
      return NextResponse.json({ error: "Email body is required" }, { status: 400 });
    }

    // Get user details for recipients — ONLY users who belong to the
    // caller's organization.
    const recipientIds = recipients
      .map((r: any) => parseInt(r.id))
      .filter((n: number) => !isNaN(n));

    const recipientUsers = await prisma.user.findMany({
      where: {
        id: { in: recipientIds },
        memberships: {
          some: { organizationId: session.organizationId },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true
      }
    });

    if (recipientUsers.length === 0) {
      return NextResponse.json({ error: "No valid recipients found" }, { status: 400 });
    }

    // Send emails to each recipient
    const emailPromises = recipientUsers.map(async (user) => {
      try {
        // Replace placeholders — escaped so user content cannot inject HTML
        // through placeholder values.
        let personalizedBody = escapeHtml(String(body))
          .replace(/\{\{name\}\}/g, escapeHtml(user.name || "User"))
          .replace(/\{\{email\}\}/g, escapeHtml(user.email))
          .replace(/\{\{role\}\}/g, escapeHtml(user.role || "User"))
          .replace(/\{\{status\}\}/g, escapeHtml(user.status || "Unknown"));

        await sendEmail({
          to: user.email,
          subject: subject.trim(),
          html: personalizedBody.replace(/\n/g, '<br>'),
          text: personalizedBody.replace(/<[^>]*>/g, "")
        });

        return { success: true, email: user.email };
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
        return { success: false, email: user.email, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      message: `Emails sent successfully to ${successful.length} recipients`,
      results: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        details: results
      }
    });

  } catch (error) {
    console.error("Error in email send endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
