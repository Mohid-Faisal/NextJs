import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

/**
 * SECURITY: identity now comes from the validated session (httpOnly cookie
 * or Bearer) instead of requiring a separately-decoded Bearer token.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only reset if user is in a PENDING_2FA_ state
    if (user.status.startsWith("PENDING_2FA_")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting 2FA status:", error);
    return NextResponse.json(
      { error: "Failed to reset 2FA status" },
      { status: 500 }
    );
  }
}
