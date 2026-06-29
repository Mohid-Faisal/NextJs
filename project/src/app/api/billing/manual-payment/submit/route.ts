import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

const MANAGE_ROLES = ["OWNER", "ADMIN"];

/**
 * POST /api/billing/manual-payment/submit
 * OWNER/ADMIN only. Submits details and proof of a manual payment (Bank Transfer, JazzCash, Easypaisa, Cash).
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  if (!MANAGE_ROLES.includes(session.orgRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { planCode, amount, method, referenceId, receiptUrl } = body;

    if (!planCode || !amount || !method || !referenceId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: planCode, amount, method, referenceId" },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) {
      return NextResponse.json({ success: false, error: "Unknown plan" }, { status: 404 });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
    }

    // Check if there is already a pending proof for this reference ID
    const existing = await prisma.paymentProof.findFirst({
      where: { referenceId: String(referenceId).trim() },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A payment proof with this transaction reference already exists" },
        { status: 409 }
      );
    }

    const proof = await prisma.paymentProof.create({
      data: {
        organizationId: session.organizationId,
        planId: plan.id,
        amount: numericAmount,
        method: String(method).toUpperCase(),
        referenceId: String(referenceId).trim(),
        receiptUrl: receiptUrl ? String(receiptUrl).trim() : null,
        status: "pending",
      },
    });

    return NextResponse.json({ success: true, proof });
  } catch (error) {
    console.error("Error submitting manual payment proof:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit payment proof" },
      { status: 500 }
    );
  }
}
