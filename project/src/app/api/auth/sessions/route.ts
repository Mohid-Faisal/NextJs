import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession, verifySessionToken, revokeSession } from "@/lib/auth/session";

/**
 * GET /api/auth/sessions — list the current user's active sessions (devices).
 * DELETE /api/auth/sessions?scope=others — revoke all sessions except this one.
 * DELETE /api/auth/sessions?scope=all    — revoke every session ("log out everywhere").
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sid = await currentSid(req);

  const rows = await prisma.authSession.findMany({
    where: {
      userId: session.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    currentSessionId: sid,
    sessions: rows.map((r) => ({ ...r, isCurrent: r.id === sid })),
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get("scope") || "others";
  const sid = await currentSid(req);
  const now = new Date();

  if (scope === "all") {
    const result = await prisma.authSession.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    // The caller's own cookie is cleared below; every other device dies now.
    const res = NextResponse.json({ success: true, revoked: result.count });
    res.cookies.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  // scope=others
  const live = await prisma.authSession.findMany({
    where: {
      userId: session.userId,
      revokedAt: null,
      expiresAt: { gt: now },
      ...(sid ? { id: { not: sid } } : {}),
    },
    select: { id: true },
  });

  await prisma.$transaction(
    live.map((s) =>
      prisma.authSession.update({ where: { id: s.id }, data: { revokedAt: now } })
    )
  );

  return NextResponse.json({ success: true, revoked: live.length });
}

async function currentSid(req: NextRequest): Promise<string | null> {
  try {
    let token = req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice(7)
      : null;
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get("token")?.value ?? null;
    }
    return token ? verifySessionToken(token)?.sid ?? null : null;
  } catch {
    return null;
  }
}
