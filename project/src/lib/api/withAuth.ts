import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import {
  getSession,
  isSuperAdmin,
  type SessionPayload,
} from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/requirePermission";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit";

export interface AuthContext<B, P> {
  req: NextRequest;
  session: SessionPayload;
  /** Parsed + validated JSON body (only when bodySchema provided). */
  body: B;
  /** Dynamic route params, already awaited (e.g. { id: "12" }). */
  params: P;
}

interface WithAuthOptions<B> {
  /**
   * Permission code checked via requirePermission (role mapping + plan/subscription
   * gating). Omit for any-authenticated-user endpoints.
   */
  permission?: string;
  /** Restrict to specific org roles. SUPER_ADMIN always passes. */
  roles?: string[];
  /** Platform super admins only. */
  superAdminOnly?: boolean;
  /** Per-IP rate limiting applied before authentication work. */
  limit?: { requests: number; windowMs: number; key?: string };
  /** Zod schema to parse+validate the JSON body server-side. */
  bodySchema?: ZodType<B>;
}

type Handler<B, P> = (ctx: AuthContext<B, P>) => Promise<Response>;

function json(status: number, payload: unknown): NextResponse {
  return NextResponse.json(payload as object, { status });
}

/**
 * Standard guard for API routes.
 *
 * Enforces, in order: rate limit → session → super-admin gate → org-role
 * gate → permission/plan gate → Zod body validation → handler.
 *
 * This centralizes the checks that were historically easy to forget
 * per-route (the root cause of most findings in the security audit).
 *
 * Usage:
 *   export const GET = withAuth(async ({ session }) => { ... });
 *
 *   export const POST = withAuth(
 *     { permission: "manage_customers", bodySchema: schema },
 *     async ({ session, body }) => { ... }
 *   );
 *
 * Dynamic routes:
 *   export const DELETE = withAuth({ permission: "manage_customers" },
 *     async ({ session, params }) => { ... }); // params: { id: string }
 */
export function withAuth<B = undefined, P = Record<string, string>>(
  handler: Handler<B, P>
): (req: NextRequest, routeCtx: { params: Promise<P> }) => Promise<Response>;
export function withAuth<B = undefined, P = Record<string, string>>(
  options: WithAuthOptions<B>,
  handler: Handler<B, P>
): (req: NextRequest, routeCtx: { params: Promise<P> }) => Promise<Response>;
export function withAuth<B = undefined, P = Record<string, string>>(
  optionsOrHandler: WithAuthOptions<B> | Handler<B, P>,
  maybeHandler?: Handler<B, P>
) {
  const options: WithAuthOptions<B> =
    typeof optionsOrHandler === "function" ? {} : optionsOrHandler;
  const handler: Handler<B, P> =
    typeof optionsOrHandler === "function" ? optionsOrHandler : maybeHandler!;

  return async (
    req: NextRequest,
    routeCtx: { params: Promise<P> } = { params: Promise.resolve({} as P) }
  ): Promise<Response> => {
    try {
      // 0. Rate limit (cheap, before auth work)
      if (options.limit) {
        const key = options.limit.key ?? new URL(req.url).pathname;
        const rl = rateLimit(
          `wa:${key}:${getClientIp(req)}`,
          options.limit.requests,
          options.limit.windowMs
        );
        if (!rl.allowed) return rateLimitResponse(rl);
      }

      // 1. Session (httpOnly cookie or Bearer)
      const session = await getSession(req);
      if (!session) {
        return json(401, { success: false, error: "Unauthorized" });
      }

      const platformAdmin = isSuperAdmin(session);

      // 2. Platform admin gate
      if (options.superAdminOnly && !platformAdmin) {
        return json(403, { success: false, error: "Forbidden" });
      }

      // 3. Org role gate
      if (options.roles && options.roles.length > 0 && !platformAdmin) {
        if (!options.roles.includes(session.orgRole)) {
          return json(403, {
            success: false,
            error: `Forbidden: requires one of roles [${options.roles.join(", ")}]`,
          });
        }
      }

      // 4. Permission gate (role→permission mapping + subscription plan gates)
      if (options.permission) {
        const auth = await requirePermission(req, options.permission);
        if (auth.error) return auth.error;
      }

      // 5. Body validation
      let body = undefined as B;
      if (options.bodySchema) {
        const raw = await req.json().catch(() => null);
        if (raw === null || typeof raw !== "object") {
          return json(400, { success: false, error: "Invalid JSON body" });
        }
        const parsed = options.bodySchema.safeParse(raw);
        if (!parsed.success) {
          return json(400, {
            success: false,
            error: "Validation failed",
            issues: parsed.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          });
        }
        body = parsed.data;
      }

      // 6. Params
      const params = await routeCtx.params;

      return await handler({ req, session, body, params });
    } catch (err) {
      console.error("[withAuth] unhandled error:", err);
      return json(500, { success: false, error: "Internal server error" });
    }
  };
}
