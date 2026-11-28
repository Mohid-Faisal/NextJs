/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Surfaces missing/recommended environment configuration early instead of
 * failing silently mid-request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Guard against LiteSpeed/lsnode (Hostinger) FD 0 socket conflict on Node.js 22:
    // ESM imports of `node:process` trigger BuiltinModule.syncExports(), which invokes
    // the `process.stdin` getter and throws `Error: open EEXIST` when lsnode owns FD 0.
    try {
      void process.stdin;
    } catch {
      const { Readable } = await import("node:stream");
      Object.defineProperty(process, "stdin", {
        value: new Readable({
          read() {
            this.push(null);
          },
        }),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }

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
