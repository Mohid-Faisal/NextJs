import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

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
  organizationId?: number;
  orgRole?: string;
  orgStatus?: string;
  platformRole?: string | null;
};

function getBearerToken(req?: Request): string | null {
  if (req) {
    const header = req.headers.get("authorization");
    if (header?.startsWith("Bearer ")) return header.slice(7);
  }
  return null;
}

export function signSessionToken(payload: {
  userId: number;
  email: string;
  name: string;
  organizationId: number;
  orgRole: string;
  orgStatus: string;
  platformRole?: string | null;
}): string {
  return jwt.sign(
    {
      id: payload.userId,
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      organizationId: payload.organizationId,
      orgRole: payload.orgRole,
      orgStatus: payload.orgStatus,
      platformRole: payload.platformRole ?? null,
    },
    JWT_SECRET,
    { expiresIn: "1w" }
  );
}

export function verifySessionToken(token: string): JwtClaims | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtClaims;
  } catch {
    return null;
  }
}

/** Resolve org-scoped session from Bearer header or `token` cookie. */
export async function getSession(req?: Request): Promise<SessionPayload | null> {
  let token = getBearerToken(req);

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
  if (!userId || !claims.email) return null;

  let organizationId = claims.organizationId;
  let orgRole = claims.orgRole;

  if (!organizationId || !orgRole) {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { id: "asc" },
      select: { organizationId: true, role: true },
    });
    if (!membership) return null;
    organizationId = membership.organizationId;
    orgRole = membership.role;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true, status: true, isApproved: true },
  });
  if (!user || !user.isApproved || user.status !== "ACTIVE") return null;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      status: true,
      subscription: { select: { plan: { select: { code: true } } } },
    },
  });
  if (!org || org.status === "suspended") return null;

  return {
    userId,
    email: claims.email,
    name: claims.name ?? "",
    organizationId,
    orgRole,
    platformRole: claims.platformRole ?? user.platformRole,
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
