import { NextResponse } from "next/server";

/**
 * Mandatory authentication for cron/scheduled endpoints.
 *
 * SECURITY: These routes perform destructive or high-volume operations, so
 * they must NEVER be callable without a secret. Vercel Cron automatically
 * sends `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is
 * set on the deployment.
 */
export function requireCronSecret(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "CRON_SECRET is not configured — refusing to run cron endpoint. Set CRON_SECRET in your environment."
    );
    return NextResponse.json(
      { success: false, error: "Cron endpoint not configured (missing CRON_SECRET)." },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
