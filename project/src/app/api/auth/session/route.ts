import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/** Lightweight session probe for client-side auth state (no sensitive data). */
export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      organizationId: session.organizationId,
      orgRole: session.orgRole,
      platformRole: session.platformRole,
    },
  });
}
