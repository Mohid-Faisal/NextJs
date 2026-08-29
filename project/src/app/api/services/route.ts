import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/**
 * SECURITY: previously unauthenticated and returned service modes across
 * ALL tenants. Now requires a session (via withAuth) and scopes to the
 * caller's org.
 */
export const GET = withAuth(async ({ session }) => {
  const services = await prisma.serviceMode.findMany({
    where: { organizationId: session.organizationId },
    orderBy: {
      name: 'asc'
    }
  });

  return NextResponse.json({
    success: true,
    data: services
  });
});
