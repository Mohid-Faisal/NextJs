import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, organizationId, planCode, paymentMethod, referenceId, receiptUrl } = body;

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

    // Create payment proof if payment details are present
    if (paymentMethod && referenceId) {
      await prisma.paymentProof.create({
        data: {
          organizationId: parseInt(organizationId, 10),
          planId: plan.id,
          amount: plan.priceMonthlyUsd,
          method: String(paymentMethod).toUpperCase(),
          referenceId: String(referenceId).trim(),
          receiptUrl: receiptUrl || null,
          status: "pending",
        }
      });
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
