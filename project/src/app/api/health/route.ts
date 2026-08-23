import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness/readiness probe for uptime monitors.
 * Verifies process is up AND the database answers a trivial query.
 */
export async function GET() {
  const startedAt = Date.now();
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const healthy = dbOk;
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { database: dbOk ? "ok" : "fail" },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
