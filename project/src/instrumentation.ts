/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Surfaces missing/recommended environment configuration early instead of
 * failing silently mid-request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warnOnMissingRecommendedEnv } = await import("@/lib/env");
    warnOnMissingRecommendedEnv();
  }
}
