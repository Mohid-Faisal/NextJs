type LogMeta = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", message: string, meta?: LogMeta) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...(meta ?? {}),
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

export const logger = {
  info: (message: string, meta?: LogMeta) => emit("info", message, meta),
  warn: (message: string, meta?: LogMeta) => emit("warn", message, meta),
  error: (message: string, meta?: LogMeta) => emit("error", message, meta),
};

/** Report an error to logs and, when SENTRY_DSN is set, to Sentry. */
export async function reportError(error: unknown, context?: LogMeta) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(err.message, {
    ...context,
    stack: err.stack,
    name: err.name,
  });

  const dsn = process.env.SENTRY_DSN;
  if (!dsn || process.env.NEXT_RUNTIME === "edge") return;

  try {
    const Sentry = await import("@sentry/node");
    if (!Sentry.getClient()) {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 0,
      });
    }
    Sentry.captureException(err, { extra: context });
  } catch {
    // Sentry is optional — never fail the request because reporting failed.
  }
}
