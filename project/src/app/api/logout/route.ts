import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, revokeSession } from "@/lib/auth/session";
import { attachSessionCookie } from "@/lib/auth/cookies";

async function currentSessionId(req: NextRequest): Promise<string | null> {
  try {
    let token = req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice(7)
      : null;
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get("token")?.value ?? null;
    }
    if (!token) return null;
    return verifySessionToken(token)?.sid ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /api/logout — revokes the server-side session row (instant
 * invalidation on every device sharing the token) and clears the httpOnly cookie.
 */
export async function POST(req: NextRequest) {
  const sid = await currentSessionId(req);
  if (sid) {
    await revokeSession(sid);
  }
  const res = NextResponse.json({ success: true });
  return attachSessionCookie(res);
}
