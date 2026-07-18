import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type TrackingHistoryEntry = {
  status: string;
  timestamp: string;
};

function parseHistory(raw: unknown): TrackingHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is TrackingHistoryEntry =>
      e != null &&
      typeof e === "object" &&
      "status" in e &&
      typeof (e as TrackingHistoryEntry).status === "string" &&
      "timestamp" in e &&
      typeof (e as TrackingHistoryEntry).timestamp === "string"
  );
}

export async function GET(request: NextRequest) {
  try {
    console.log("🕐 Cron job: Starting subscription expiration check...");

    // Verify this is a legitimate cron request (similar to check-inactive-customers)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const requestAuth = request.headers.get("authorization") ?? "";
      const isAuthorized =
        requestAuth === `Bearer ${cronSecret}` || requestAuth === cronSecret;
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, message: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Define target range: exactly 3 days from now (in UTC)
    const targetStart = new Date();
    targetStart.setDate(targetStart.getDate() + 3);
    targetStart.setUTCHours(0, 0, 0, 0);

    const targetEnd = new Date(targetStart);
    targetEnd.setUTCHours(23, 59, 59, 999);

    console.log(`📅 Checking for subscriptions expiring between: ${targetStart.toISOString()} and ${targetEnd.toISOString()}`);

    // Query active/trialing subscriptions expiring in exactly 3 days
    // Exclude super admin (ID 1)
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId: { not: 1 },
        status: { in: ["active", "trialing"] },
        OR: [
          {
            status: "trialing",
            trialEndsAt: {
              gte: targetStart,
              lte: targetEnd
            }
          },
          {
            status: "active",
            currentPeriodEnd: {
              gte: targetStart,
              lte: targetEnd
            }
          }
        ]
      },
      include: {
        organization: true,
        plan: true
      }
    });

    console.log(`📊 Found ${subscriptions.length} subscriptions expiring in 3 days.`);

    const results = [];

    for (const sub of subscriptions) {
      // Find all approved members/users for this organization
      const members = await prisma.organizationMember.findMany({
        where: {
          organizationId: sub.organizationId
        },
        include: {
          user: true
        }
      });

      const expirationDate = sub.status === "trialing" ? sub.trialEndsAt : sub.currentPeriodEnd;
      const formattedDate = expirationDate
        ? new Date(expirationDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          })
        : "in 3 days";

      const emailsSent = [];

      for (const member of members) {
        if (member.user && member.user.email && member.user.isApproved) {
          const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <div style="background-color: #f8fafc; text-align: center; padding: 24px; border-bottom: 1px solid #e2e8f0;">
                <img src="https://psswwe.com/logo_final.png" alt="PSSWWE" style="max-height: 50px; display: inline-block;" />
              </div>
              
              <div style="padding: 32px 24px;">
                <h2 style="color: #0284c7; margin-top: 0; font-size: 20px; font-weight: 700;">Your Subscription is Expiring in 3 Days</h2>
                
                <p>Hello ${member.user.name},</p>
                
                <p>This is a friendly reminder that your subscription to the <strong>${sub.plan.name}</strong> plan for your organization <strong>${sub.organization.name}</strong> is set to expire on <strong>${formattedDate}</strong>.</p>
                
                <p>To ensure uninterrupted access to your courier operations, shipments, and customer tracking portals, please renew or update your subscription plan before the expiration date.</p>
                
                <div style="text-align: center; margin: 36px 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://psswwe.com"}/dashboard/settings/billing" 
                     style="background-color: #0284c7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(2, 132, 199, 0.2);">
                    Manage Subscription & Billing
                  </a>
                </div>
                
                <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">
                  If you have already renewed or set up automatic billing with an administrator, you can safely ignore this reminder.
                </p>
              </div>
              
              <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
                <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                  © ${new Date().getFullYear()} PSSWWE. All rights reserved.
                </p>
              </div>
            </div>
          `;

          try {
            await sendEmail({
              to: member.user.email,
              subject: `Action Required: Your ${sub.plan.name} Plan is Expiring in 3 Days - ${sub.organization.name}`,
              html: emailBody
            });
            emailsSent.push(member.user.email);
          } catch (mailErr) {
            console.error(`Failed to send reminder email to ${member.user.email}:`, mailErr);
          }
        }
      }

      results.push({
        organizationId: sub.organizationId,
        organizationName: sub.organization.name,
        planName: sub.plan.name,
        expirationDate: expirationDate?.toISOString(),
        emailsSent
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: subscriptions.length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Subscription reminder cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
