import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { send2FACodeEmail } from "@/lib/email";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const orgId = parseInt(id, 10);
    
    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    // Get the request body for password verification
    const body: { password: string } = await request.json().catch(() => ({}));
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    // Get the current super admin user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Check if organization exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
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
      
      // Revert status on failure
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
    console.error("Error in send-2fa organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
