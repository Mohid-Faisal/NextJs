import { NextResponse } from "next/server";

/**
 * Session cookie helpers. The JWT is set as an httpOnly cookie so client-side
 * JavaScript (and therefore XSS payloads) cannot read it. SameSite=Lax blocks
 * cross-site POSTs from attaching the cookie, which is our CSRF mitigation
 * alongside JSON-only APIs.
 */

export const SESSION_COOKIE = "token";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 1 week, matches JWT expiry

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Attach the session cookie (or clear it) on a NextResponse. */
export function attachSessionCookie(res: NextResponse, token?: string): NextResponse {
  if (token) {
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  } else {
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  }
  return res;
}
