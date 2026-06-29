import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

function decodeToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET || "your-secret-key";
    return jwt.verify(token, secret) as { id: string; [key: string]: unknown };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = decodeToken(token);

    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.id) },
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
