import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUserApprovalEmail } from "@/lib/email";
import { defaultAccounts } from "@/lib/accounts/defaultAccounts";
import { fetchExchangeRates } from "@/lib/currency";

/**
 * SECURITY: previously fully unauthenticated — anyone could upsert ANY
 * organization's subscription/plan/status or forge payment proofs.
 *
 * Now this endpoint only works for a user who has VERIFIED their email and
 * is in the PENDING_PLAN_SELECTION state, and ONLY for the organization
 * they own (resolved server-side from their membership — the client-supplied
 * organizationId must match it). Self-service trial selection adds no
 * privilege beyond what open signup already grants.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, planCode, paymentMethod, referenceId, receiptUrl, billingCycle } = body;

    if (!userId || !planCode) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: userId, planCode" },
        { status: 400 }
      );
    }

    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      return NextResponse.json(
        { success: false, message: "Invalid userId" },
        { status: 400 }
      );
    }

    // Only a user whose email verification completed may pick a plan, and
    // only for their own workspace.
    const user = await prisma.user.findUnique({
      where: { id: parsedUserId },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!user || user.status !== "PENDING_PLAN_SELECTION") {
      return NextResponse.json(
        { success: false, message: "Plan selection not available for this account." },
        { status: 403 }
      );
    }

    const ownership = await prisma.organizationMember.findFirst({
      where: { userId: user.id, role: "OWNER" },
      select: { organizationId: true },
    });
    if (!ownership) {
      return NextResponse.json(
        { success: false, message: "No organization found for this account." },
        { status: 403 }
      );
    }
    const organizationId = ownership.organizationId;

    // If the client supplied an organizationId it must be their own.
    if (body.organizationId !== undefined && parseInt(body.organizationId, 10) !== organizationId) {
      return NextResponse.json(
        { success: false, message: "Organization mismatch." },
        { status: 403 }
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
      where: { organizationId: organizationId },
      update: {
        planId: plan.id,
        status: isTrial ? "trialing" : "pending",
        trialEndsAt,
      },
      create: {
        organizationId: organizationId,
        planId: plan.id,
        status: isTrial ? "trialing" : "pending",
        trialEndsAt,
      }
    });

    // Update organization status based on selected plan
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: isTrial ? "trial" : "pending",
      },
    });

    // Ensure Chart of Accounts is initialized for the organization when upgrading
    try {
      const orgId = organizationId;
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
      // Retrieve organization currency resolved during signup
      const orgDetails = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { currency: true }
      });
      const currency = orgDetails?.currency || "PKR";
      const isPakistan = currency === "PKR";

      const rates = await fetchExchangeRates();
      const rate = rates[currency] || 1;
      const pkrRate = rates["PKR"] || 278.0;
      const pkrToLocalRate = isPakistan ? 1.0 : (rate / pkrRate) * 1.10;

      const convertedPriceMonthly = plan.priceMonthlyUsd * pkrToLocalRate;

      const isAnnual = billingCycle === "annually";
      const features = plan.features ? (plan.features as any) : {};
      const discountPercent = features.yearlyDiscountPercent !== undefined 
        ? parseFloat(features.yearlyDiscountPercent) 
        : 20;
      const localPriceAnnual = convertedPriceMonthly * 12 * (1 - (discountPercent / 100));
      const amount = isAnnual ? localPriceAnnual : convertedPriceMonthly;

      // Calculate exact PKR equivalent (base is in PKR)
      const priceMonthlyPkr = plan.priceMonthlyUsd;
      const priceAnnualPkr = priceMonthlyPkr * 12 * (1 - (discountPercent / 100));
      const amountPkr = isAnnual ? priceAnnualPkr : priceMonthlyPkr;

      await prisma.paymentProof.create({
        data: {
          organizationId: organizationId,
          planId: plan.id,
          amount: amount,
          currency: currency,
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
