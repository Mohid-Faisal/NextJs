import { NextResponse } from "next/server";
import { getSession, isSuperAdmin, type SessionPayload } from "@/lib/auth/session";

type SuperAdminResult =
  | { session: SessionPayload; error: null }
  | { session: null; error: NextResponse };

/**
 * Guard for platform (SaaS) admin endpoints. Requires a valid session AND
 * platformRole === "SUPER_ADMIN". Returns 401 when unauthenticated and 403
 * when the user is authenticated but not a super admin.
 */
export async function requireSuperAdmin(req: Request): Promise<SuperAdminResult> {
  const session = await getSession(req);
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isSuperAdmin(session)) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}
