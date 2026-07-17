import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUserApprovalEmail } from "@/lib/email";
import { defaultAccounts } from "@/lib/accounts/defaultAccounts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, organizationId, planCode, paymentMethod, referenceId, receiptUrl, billingCycle } = body;

    if (!userId || !organizationId || !planCode) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: userId, organizationId, planCode" },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.findUnique({
      where: { code: planCode }
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, message: `Plan with code "${planCode}" not found.` },
        { status: 404 }
      );
    }

    const isTrial = plan.code === "trial";
    const trialEndsAt = isTrial ? new Date() : null;
    if (trialEndsAt) {
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    }

    // Upsert subscription for the organization
    await prisma.subscription.upsert({
      where: { organizationId: parseInt(organizationId, 10) },
      update: {
        planId: plan.id,
        status: isTrial ? "trialing" : "pending",
        trialEndsAt,
      },
      create: {
        organizationId: parseInt(organizationId, 10),
        planId: plan.id,
        status: isTrial ? "trialing" : "pending",
        trialEndsAt,
      }
    });

    // Update organization status based on selected plan
    await prisma.organization.update({
      where: { id: parseInt(organizationId, 10) },
      data: {
        status: isTrial ? "trial" : "pending",
      },
    });

    // Ensure Chart of Accounts is initialized for the organization when upgrading
    try {
      const orgId = parseInt(organizationId, 10);
      const existingCount = await prisma.chartOfAccount.count({
        where: { organizationId: orgId }
      });
      if (existingCount === 0) {
        await prisma.chartOfAccount.createMany({
          data: defaultAccounts.map((account) => ({
            ...account,
            organizationId: orgId,
            isActive: true,
          })),
        });
      }
    } catch (err) {
      console.error("Failed to seed default accounts during plan upgrade:", err);
    }

    // Create payment proof if payment details are present
    if (paymentMethod && referenceId) {
      const isAnnual = billingCycle === "annually";
      const features = plan.features ? (plan.features as any) : {};
      const discountPercent = features.yearlyDiscountPercent !== undefined 
        ? parseFloat(features.yearlyDiscountPercent) 
        : (features.annualPrice && plan.priceMonthlyUsd > 0 
          ? Math.round((1 - (features.annualPrice / (plan.priceMonthlyUsd * 12))) * 100) 
          : 20);
      const annualPrice = features.annualPrice ?? (plan.priceMonthlyUsd * 12 * (1 - (discountPercent / 100)));
      const amount = isAnnual ? annualPrice : plan.priceMonthlyUsd;

      await prisma.paymentProof.create({
        data: {
          organizationId: parseInt(organizationId, 10),
          planId: plan.id,
          amount: amount,
          method: String(paymentMethod).toUpperCase(),
          referenceId: String(referenceId).trim(),
          receiptUrl: receiptUrl || null,
          status: "pending",
        }
      });
    }

    // Trigger admin approval request when:
    // 1. User selects the trial plan (free trial — no payment needed), OR
    // 2. User selects a paid plan AND submits payment details.
    const shouldTriggerApproval = isTrial || (paymentMethod && referenceId);

    if (shouldTriggerApproval && userId) {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId, 10) },
        select: { id: true, name: true, email: true, status: true },
      });

      if (user && (user.status === "PENDING_PLAN_SELECTION" || user.status === "PENDING_VERIFICATION" || user.status === "PENDING_APPROVAL")) {
        // Update user status to PENDING_APPROVAL
        await prisma.user.update({
          where: { id: user.id },
          data: { status: "PENDING_APPROVAL" },
        });

        // Send approval email to super admin
        try {
          const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/users/approve/${user.id}`;
          await sendUserApprovalEmail({
            userName: user.name,
            userEmail: user.email,
            approvalUrl,
          });
        } catch (emailError) {
          console.error("Failed to send approval email during plan update:", emailError);
          // Non-fatal — admin can still see the pending approval in the dashboard
        }
      }
    }

    return NextResponse.json({ success: true, message: "Subscription plan updated successfully." });
  } catch (error) {
    console.error("Error updating signup plan:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
