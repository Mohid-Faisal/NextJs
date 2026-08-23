import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

/**
 * SECURITY hardening vs. previous version:
 *  - Full session validation instead of raw jwt.verify (which accepted
 *    tokens of deleted/suspended users).
 *  - Only returns users who are members of the CALLER'S organization —
 *    previously enumerated every user on the platform (cross-tenant PII).
 *  - Restricted to OWNER/ADMIN roles.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const privileged =
      session.platformRole === "SUPER_ADMIN" ||
      session.orgRole === "OWNER" ||
      session.orgRole === "ADMIN";

    if (!privileged) {
      return NextResponse.json(
        { error: "Forbidden: only organization admins can list members." },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    // Tenant scope: only users with a membership in the caller's org.
    const where: any = {
      memberships: {
        some: { organizationId: session.organizationId },
      },
    };

    if (search) {
      where.OR = [
        { name: { contains: search} },
        { email: { contains: search} }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    // Get unique roles and statuses for filters (within this org)
    const orgUserIds = await prisma.organizationMember.findMany({
      where: { organizationId: session.organizationId },
      select: { userId: true },
    });
    const memberWhere = { id: { in: orgUserIds.map(m => m.userId) } };

    const [roles, statuses] = await Promise.all([
      prisma.user.findMany({
        where: memberWhere,
        select: { role: true },
        distinct: ['role'],
        orderBy: { role: 'asc' }
      }),
      prisma.user.findMany({
        where: memberWhere,
        select: { status: true },
        distinct: ['status'],
        orderBy: { status: 'asc' }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        filters: {
          roles: roles.map(r => r.role),
          statuses: statuses.map(s => s.status)
        }
      }
    });

  } catch (error) {
    console.error("Error in email users endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
