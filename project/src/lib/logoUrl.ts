/**
 * SECURITY: validation for organization logoUrl values.
 *
 * logoUrl is consumed by server-side sinks that either fetch the URL
 * (SSRF risk) or join it onto process.cwd()/public (path traversal / local
 * file read risk). These validators enforce:
 *  - Remote URLs: https only (http allowed in dev), no credentials, no
 *    private/loopback/link-local/metadata hosts.
 *  - Local paths: must be rooted, must not contain "..", must resolve
 *    inside the application's public directory.
 */

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?fc00:/i,
  /^\[?fd/i,
  /\.internal$/i,
  /\.local$/i,
];

export function validateLogoUrl(raw: string): { ok: true } | { ok: false; reason: string } {
  const value = (raw ?? "").trim();

  if (!value) {
    return { ok: true }; // null/empty is allowed (clears the logo)
  }

  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return { ok: false, reason: "Invalid logo URL" };
    }

    if (url.username || url.password) {
      return { ok: false, reason: "Logo URL must not contain credentials" };
    }

    const isLocalDev = process.env.NODE_ENV !== "production";
    if (url.protocol === "http:" && !isLocalDev) {
      return { ok: false, reason: "Logo URL must use https" };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { ok: false, reason: "Logo URL must be http(s)" };
    }

    const host = url.hostname;
    for (const pattern of BLOCKED_HOST_PATTERNS) {
      if (pattern.test(host)) {
        return { ok: false, reason: "Logo URL host is not allowed" };
      }
    }

    if (!host.includes(".")) {
      return { ok: false, reason: "Logo URL host is not allowed" };
    }

    return { ok: true };
  }

  if (value.startsWith("/")) {
    if (value.includes("..")) {
      return { ok: false, reason: "Logo URL path must not contain '..'" };
    }
    if (/[\0\r\n]/.test(value)) {
      return { ok: false, reason: "Logo URL path contains invalid characters" };
    }
    return { ok: true };
  }

  return { ok: false, reason: "Logo URL must be an https URL or a rooted path under /public" };
}

import * as path from "path";

/**
 * Resolve a validated local logo path to an absolute path and guarantee it
 * stays inside the public directory. Returns null when the value is remote
 * or unsafe.
 */
export function resolvePublicLogoPath(logoUrl: string): string | null {
  const value = (logoUrl ?? "").trim();
  if (!value || /^https?:\/\//i.test(value)) return null;
  if (!value.startsWith("/") || value.includes("..")) return null;

  const publicRoot = path.resolve(process.cwd(), "public");
  const resolved = path.resolve(publicRoot, `.${value}`);
  if (resolved !== publicRoot && !resolved.startsWith(publicRoot + path.sep)) {
    return null;
  }
  return resolved;
}

/**
 * Validate a remote logo URL at read time (defense-in-depth for fetch sinks).
 * Returns null when the value is not a safe remote URL.
 */
export function safeRemoteLogoUrl(logoUrl: string): string | null {
  const value = (logoUrl ?? "").trim();
  if (!/^https?:\/\//i.test(value)) return null;
  const check = validateLogoUrl(value);
  return check.ok ? value : null;
}
