import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth/session";

type ApiSessionResult =
  | { session: SessionPayload; error: null }
  | { session: null; error: NextResponse };

export async function requireApiSession(req: Request): Promise<ApiSessionResult> {
  const session = await getSession(req);
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}
