import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getJwtSecretString } from "@/lib/auth/jwtSecret";

export { getJwtSecretString };

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 1 week

export type SessionPayload = {
  userId: number;
  email: string;
  name: string;
  organizationId: number;
  orgRole: string;
  platformRole: string | null;
  planCode: string | null;
};

type JwtClaims = {
  id?: number;
  userId?: number;
  email?: string;
  name?: string;
  /** Server-side session id — must match a live, non-revoked AuthSession row. */
  sid?: string;
};

function getBearerToken(req?: Request): string | null {
  if (req) {
    const header = req.headers.get("authorization");
    if (header?.startsWith("Bearer ")) return header.slice(7);
  }
  return null;
}

/**
 * Create a server-side session row and return a JWT bound to it via `sid`.
 * Revoking the row instantly invalidates the token everywhere.
 */
export async function createSession(
  payload: {
    userId: number;
    email: string;
    name: string;
    organizationId: number;
    orgRole: string;
    orgStatus: string;
    platformRole?: string | null;
  },
  meta?: { ip?: string | null; userAgent?: string | null }
): Promise<{ token: string; sessionId: string }> {
  const sessionId = randomUUID();

  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId: payload.userId,
      organizationId: payload.organizationId,
      ipAddress: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 300) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  });

  // Opportunistic hygiene: drop this user's expired sessions.
  try {
    await prisma.authSession.deleteMany({
      where: { userId: payload.userId, expiresAt: { lt: new Date() } },
    });
  } catch {
    // non-fatal
  }

  const token = jwt.sign(
    {
      id: payload.userId,
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      sid: sessionId,
    },
    getJwtSecretString(),
    { expiresIn: SESSION_TTL_SECONDS }
  );

  return { token, sessionId };
}

/** Backwards-compatible alias used by older call sites. */
export function signSessionToken(payload: {
  userId: number;
  email: string;
  name: string;
  organizationId: number;
  orgRole: string;
  orgStatus: string;
  platformRole?: string | null;
}): never {
  throw new Error(
    "signSessionToken() removed — use createSession() so a server-side session row is created."
  );
}

export function verifySessionToken(token: string): JwtClaims | null {
  try {
    // Type-only cast; authorization-relevant fields (orgRole, platformRole,
    // orgStatus, organizationId) are ALWAYS re-loaded from the database in
    // getSession() so stale or forged claims can never grant privileges.
    return jwt.verify(token, getJwtSecretString()) as JwtClaims;
  } catch {
    return null;
  }
}

/** Revoke one session (logout). */
export async function revokeSession(sessionId: string) {
  try {
    await prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // non-fatal
  }
}

/** Revoke every live session for a user ("log out all devices" / ban). */
export async function revokeAllUserSessions(userId: number) {
  try {
    await prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // non-fatal
  }
}

/** Resolve org-scoped session from Bearer header or `token` cookie. */
export async function getSession(req?: Request): Promise<SessionPayload | null> {
  let token = getBearerToken(req);

  if (token) {
    const claims = verifySessionToken(token);
    // SECURITY/compat: if a stale or invalid Bearer header is presented,
    // fall through to the httpOnly cookie instead of failing outright —
    // otherwise cached client code sending dead tokens locks users out.
    if (!claims) {
      token = null;
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get("token")?.value ?? null;
    } catch {
      // cookies() unavailable outside request context
    }
  }

  if (!token) return null;

  const claims = verifySessionToken(token);
  if (!claims) return null;

  const userId = claims.userId ?? claims.id;
  if (!userId || !claims.email || !claims.sid) return null;

  // The JWT is only useful while its server-side session row is alive.
  const authSession = await prisma.authSession.findUnique({
    where: { id: claims.sid },
    select: { userId: true, revokedAt: true, expiresAt: true, lastSeenAt: true },
  });
  if (!authSession) return null;
  if (authSession.revokedAt) return null;
  if (authSession.expiresAt.getTime() < Date.now()) return null;

  // Throttled last-seen update (at most once per 5 minutes per session).
  if (Date.now() - authSession.lastSeenAt.getTime() > 5 * 60 * 1000) {
    try {
      await prisma.authSession.update({
        where: { id: claims.sid },
        data: { lastSeenAt: new Date() },
      });
    } catch {
      // non-fatal
    }
  }

  // Identity comes from the token; ALL privileges come from the database.
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { id: "asc" },
    select: { organizationId: true, role: true },
  });
  if (!membership) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, platformRole: true, status: true, isApproved: true },
  });
  if (!user) return null;
  if (user.email.toLowerCase() !== claims.email.toLowerCase()) return null;

  const userStatus = user.status?.toUpperCase() || "";
  if (!user.isApproved) return null;
  // PENDING_PASSWORD_RESET must not invalidate sessions or block login:
  // knowing an email address must never enable a lockout. Completing the
  // reset still requires the emailed code.
  const allowedPending =
    userStatus.startsWith("PENDING_2FA_") ||
    userStatus.startsWith("PENDING_PASSWORD_RESET_");
  if (userStatus !== "ACTIVE" && !allowedPending) return null;

  const org = await prisma.organization.findUnique({
    where: { id: membership.organizationId },
    select: {
      status: true,
      subscription: { select: { plan: { select: { code: true } } } },
    },
  });
  if (!org || org.status === "suspended") return null;

  return {
    userId,
    email: user.email,
    name: claims.name ?? "",
    organizationId: membership.organizationId,
    orgRole: membership.role,
    platformRole: user.platformRole,
    planCode: org.subscription?.plan.code ?? null,
  };
}

export function requireSession(session: SessionPayload | null): SessionPayload {
  if (!session) throw new Error("Unauthorized");
  return session;
}

export function isSuperAdmin(session: SessionPayload): boolean {
  return session.platformRole === "SUPER_ADMIN";
}
