"use client";

/**
 * Client-side session accessor.
 *
 * SECURITY: the session JWT is now an httpOnly cookie, so client code can no
 * longer decode identity/role claims from the token. Use this helper to fetch
 * the current session from the server instead. Result is cached per page load.
 */

export type ClientSessionUser = {
  id: number;
  name: string;
  email: string;
  organizationId: number;
  orgRole: string;
  platformRole: string | null;
};

export type ClientSession = {
  authenticated: boolean;
  user?: ClientSessionUser;
};

let cache: ClientSessionUser | null | undefined;
let inflight: Promise<ClientSessionUser | null> | null = null;

/** Fetch (and memoize) the current session user. Returns null when logged out. */
export async function getClientSession(): Promise<ClientSessionUser | null> {
  if (cache) return cache;

  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (!res.ok) {
          cache = null;
          return null;
        }
        const data: ClientSession = await res.json();
        cache = data.user ?? null;
        return cache;
      } catch {
        cache = null;
        return null;
      } finally {
        inflight = null;
      }
    })();
  }

  return inflight;
}

/** Clear the memoized session (call after logout). */
export function clearClientSessionCache() {
  cache = undefined;
  inflight = null;
}
