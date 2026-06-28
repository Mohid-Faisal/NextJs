import type { SessionPayload } from "@/lib/auth/session";

type WhereExtra = Record<string, unknown>;

/** Standard tenant filter — use on every find/update/delete for tenant-owned rows. */
export function orgWhere(session: SessionPayload, extra: WhereExtra = {}) {
  return { organizationId: session.organizationId, ...extra };
}

export function requireOrg(session: SessionPayload | null): SessionPayload {
  if (!session?.organizationId) {
    throw new Error("Organization context required");
  }
  return session;
}

/** For creates — never trust organizationId from client body. */
export function orgData<T extends Record<string, unknown>>(
  session: SessionPayload,
  data: T
): T & { organizationId: number } {
  return { ...data, organizationId: session.organizationId };
}
