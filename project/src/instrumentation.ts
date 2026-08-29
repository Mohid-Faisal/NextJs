/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Surfaces missing/recommended environment configuration early instead of
 * failing silently mid-request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warnOnMissingRecommendedEnv } = await import("@/lib/env");
    warnOnMissingRecommendedEnv();

    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      try {
        const Sentry = await import("@sentry/node");
        if (!Sentry.getClient()) {
          Sentry.init({
            dsn,
            environment: process.env.NODE_ENV,
            tracesSampleRate: 0,
          });
        }
      } catch {
        console.warn("[instrumentation] @sentry/node is not installed; SENTRY_DSN is ignored.");
      }
    }
  }
}
