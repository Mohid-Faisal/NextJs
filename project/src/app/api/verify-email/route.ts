import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUserApprovalEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, verificationCode } = body;

    // Find user with pending verification
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        status: {
          startsWith: "PENDING_VERIFICATION_"
        }
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found or already verified" },
        { status: 400 }
      );
    }

    // Parse verification data from status field
    // Format: PENDING_VERIFICATION_<code>_<expiry>
    const statusParts = user.status.split('_');
    if (statusParts.length !== 4) {
      return NextResponse.json(
        { success: false, message: "Invalid verification status" },
        { status: 400 }
      );
    }

    const storedCode = statusParts[2];
    const expiryTimestamp = parseInt(statusParts[3]);

    // Check if code matches and hasn't expired
    if (storedCode !== verificationCode) {
      return NextResponse.json(
        { success: false, message: "Invalid verification code" },
        { status: 400 }
      );
    }

    if (Date.now() > expiryTimestamp) {
      return NextResponse.json(
        { success: false, message: "Verification code has expired" },
        { status: 400 }
      );
    }

    // Verify the code and update user status
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "PENDING_APPROVAL",
        isApproved: false,
        role: "USER", // Set default role
      },
    });

    // Send approval email to admin
    try {
      const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/users/approve/${user.id}`;
      await sendUserApprovalEmail({
        userName: user.name,
        userEmail: user.email,
        approvalUrl,
      });
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail verification if admin email fails
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully! Your account is now pending admin approval. You will be notified once approved.",
    });

  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
