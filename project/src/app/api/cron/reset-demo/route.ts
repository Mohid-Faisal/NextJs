import { NextRequest, NextResponse } from "next/server";
import { resetDemoUserEntries } from "@/lib/auth/demoAccount";
import { requireCronSecret } from "@/lib/auth/cronAuth";

/**
 * GET /api/cron/reset-demo
 * Cleans up user-added entries in the demo account (older than 24 hours or forced),
 * preserving all default sample demo entries.
 *
 * SECURITY: destructive operation — requires the CRON_SECRET bearer token.
 */
export async function GET(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  try {
    await resetDemoUserEntries();
    return NextResponse.json({
      success: true,
      message: "Demo workspace user entries reset successfully. Default sample entries preserved.",
      resetAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in reset-demo cron:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset demo workspace" },
      { status: 500 }
    );
  }
}
