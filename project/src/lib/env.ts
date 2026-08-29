/**
 * Environment validation.
 *
 * SECURITY/ops: misconfigured environments previously failed silently — the
 * worst case (missing JWT_SECRET) used to fall back to a publicly known
 * signing key. Required secrets now fail closed at first use, and this
 * module provides a single typed view of the server environment.
 *
 * Import `serverEnv` from server-side code only.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your deployment environment before starting the server.`
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Validated, lazily-evaluated server environment.
 * Accessors throw on first use if a required variable is missing.
 */
export const serverEnv = {
  get JWT_SECRET() {
    return required("JWT_SECRET");
  },
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get CRON_SECRET(): string | undefined {
    return optional("CRON_SECRET");
  },
  get STRIPE_SECRET_KEY(): string | undefined {
    return optional("STRIPE_SECRET_KEY");
  },
  get STRIPE_WEBHOOK_SECRET(): string | undefined {
    return optional("STRIPE_WEBHOOK_SECRET");
  },
  get RESEND_API_KEY(): string | undefined {
    return optional("RESEND_API_KEY");
  },
  get CPANEL_UPLOAD_SECRET_KEY(): string | undefined {
    return optional("CPANEL_UPLOAD_SECRET_KEY");
  },
  get GOOGLE_CLIENT_ID(): string | undefined {
    return optional("GOOGLE_CLIENT_ID");
  },
  get GOOGLE_CLIENT_SECRET(): string | undefined {
    return optional("GOOGLE_CLIENT_SECRET");
  },
  get NEXT_PUBLIC_APP_URL(): string {
    return optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
  },
};

/** Warn (once) about recommended-but-missing configuration at startup. */
let warned = false;
export function warnOnMissingRecommendedEnv() {
  if (warned) return;
  warned = true;
  const recommended: [string, string][] = [
    ["CRON_SECRET", "cron endpoints refuse to run without it"],
    ["RESEND_API_KEY", "verification/password-reset emails will fail"],
    ["CPANEL_UPLOAD_SECRET_KEY", "file uploads will fail"],
  ];
  for (const [key, why] of recommended) {
    if (!process.env[key]) {
      console.warn(`[env] ${key} is not set — ${why}.`);
    }
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    console.warn(
      "[env] JWT_SECRET is shorter than 32 chars — use a long random value (e.g. `openssl rand -base64 48`)."
    );
  }
}
