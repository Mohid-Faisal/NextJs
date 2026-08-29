import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { send2FACodeEmail } from "@/lib/email";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { randomInt } from "node:crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const shipmentId = parseInt(id);

    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { error: "Invalid shipment ID" },
        { status: 400 }
      );
    }

    // SECURITY: identity now comes from the validated session (httpOnly
    // cookie or Bearer) instead of requiring a raw Bearer token decode.

    // Get the request body for password verification
    const body: { password: string } = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    // Check if shipment exists
    const shipment = await prisma.shipment.findFirst({
      where: orgWhere(session, { id: shipmentId }),
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Generate 6-digit verification code
    const verificationCode = randomInt(100000, 1000000).toString();
    
    // Store the verification code temporarily (you might want to use Redis in production)
    // For now, we'll store it in the user's status field temporarily
    // In production, consider using a proper session store or Redis
    const tempStatus = `PENDING_2FA_${verificationCode}_${Date.now()}`;
    
    await prisma.user.update({
      where: { id: user.id },
      data: { status: tempStatus },
    });

    // Send 2FA code via email
    try {
      await send2FACodeEmail(user.email, user.name, verificationCode);
      
      return NextResponse.json({
        success: true,
        message: "Verification code sent successfully",
        expiresIn: "10 minutes"
      });
    } catch (emailError) {
      console.error("Error sending 2FA email:", emailError);
      
      // Revert the status change if email fails
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE" },
      });
      
      return NextResponse.json(
        { error: "Failed to send verification code. Please try again." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in send-2fa:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
