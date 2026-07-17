import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";
import { createOrganizationForSignup } from "@/lib/auth/membership";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, companyName, planCode, phone, address, paymentMethod, referenceId, receiptUrl } = body;

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && !existingUser.status.startsWith("INVITED")) {
      return NextResponse.json(
        { success: false, message: "User with this email already exists" },
        { status: 400 }
      );
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationStatus = `PENDING_VERIFICATION_${verificationCode}_${Date.now() + 10 * 60 * 1000}`;

    const resolvedName = name?.trim() || email.trim().split("@")[0];

    let user;
    if (existingUser && existingUser.status.startsWith("INVITED")) {
      // Update the pre-created invited user record
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: resolvedName,
          password: hashedPassword,
          status: verificationStatus,
          phone: phone?.trim() || undefined,
          address: address?.trim() || undefined,
        },
      });
    } else {
      // Standard new user sign up
      user = await prisma.user.create({
        data: {
          name: resolvedName,
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          status: verificationStatus,
          isApproved: false,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
        },
      });
    }

    let organization: { id: number; slug: string } | null = null;
    if (companyName?.trim()) {
      try {
        organization = await createOrganizationForSignup(
          companyName.trim(),
          user.id,
          typeof planCode === "string" && planCode.trim() ? planCode.trim() : "trial"
        );
      } catch (orgError) {
        await prisma.user.delete({ where: { id: user.id } });
        console.error("Org creation failed during signup:", orgError);
        return NextResponse.json(
          { success: false, message: "Could not create organization. Try a different company name." },
          { status: 400 }
        );
      }

      // Create payment proof if paid plan details were provided
      if (organization && paymentMethod && referenceId) {
        try {
          const plan = await prisma.plan.findUnique({ where: { code: planCode?.trim() || "trial" } });
          if (plan) {
            await prisma.paymentProof.create({
              data: {
                organizationId: organization.id,
                planId: plan.id,
                amount: plan.priceMonthlyUsd,
                method: String(paymentMethod).toUpperCase(),
                referenceId: String(referenceId).trim(),
                receiptUrl: receiptUrl || null,
                status: "pending",
              },
            });
          }
        } catch (paymentError) {
          console.error("Payment proof creation failed during signup:", paymentError);
          // Non-fatal — org is still created, admin can handle manually
        }
      }
    }

    const emailSent = await sendVerificationEmail(email, name, verificationCode);

    if (!emailSent) {
      await prisma.organizationMember.deleteMany({ where: { userId: user.id } });
      if (organization) {
        await prisma.subscription.deleteMany({ where: { organizationId: organization.id } });
        await prisma.organization.delete({ where: { id: organization.id } });
      }
      await prisma.user.delete({ where: { id: user.id } });
      return NextResponse.json(
        { success: false, message: "Failed to send verification email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Verification code sent to your email. Please check your inbox and enter the 6-digit code.",
      userId: user.id,
      organization,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
