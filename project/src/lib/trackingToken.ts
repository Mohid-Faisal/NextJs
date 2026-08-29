import crypto from "crypto";
import { getJwtSecretString } from "@/lib/auth/jwtSecret";

/**
 * Signed public tracking tokens (#anti-enumeration).
 *
 * The public tracking page previously relied on guessable sequential
 * tracking IDs (rate limiting only slows enumeration). Admins can now hand
 * out URLs containing an HMAC-signed token that expires — unguessable and
 * revocable by expiry.
 *
 * Token format: {trackingId}.{expiryEpochSeconds}.{hmac}
 * HMAC is derived from JWT_SECRET so no additional secret is required.
 */

const DEFAULT_TTL_DAYS = 365;

function hmacKey(): Buffer {
  return crypto.createHash("sha256").update(`tracking:${getJwtSecretString()}`).digest();
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", hmacKey()).update(payload).digest("base64url");
}

export function signTrackingToken(
  trackingId: string,
  ttlDays: number = DEFAULT_TTL_DAYS
): string {
  const id = trackingId.trim();
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
  const payload = `${id}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyTrackingToken(token: string): string | null {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) return null;

  const [idRaw, expRaw, sig] = parts;
  const exp = parseInt(expRaw, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;

  const payload = `${idRaw}.${expRaw}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const id = decodeURIComponent(idRaw);
  return id || null;
}

/** Build a full public tracking URL for a shipment. */
export function buildTrackingUrl(trackingId: string, appUrl?: string): string {
  const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const token = signTrackingToken(trackingId);
  return `${base}/tracking?t=${encodeURIComponent(token)}`;
}
