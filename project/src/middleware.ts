import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

type TokenPayload = {
  organizationId?: number;
  orgRole?: string;
  orgStatus?: string;
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  const isProtected = pathname.startsWith("/dashboard");

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "your-secret-key"
    );
    const { payload } = await jwtVerify(token, secret);
    const claims = payload as TokenPayload;

    if (claims.orgStatus === "suspended") {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("error", "org-suspended");
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("token");
      return res;
    }

    const res = NextResponse.next();
    if (claims.organizationId != null) {
      res.headers.set("x-organization-id", String(claims.organizationId));
    }
    if (claims.orgRole) {
      res.headers.set("x-org-role", claims.orgRole);
    }
    return res;
  } catch {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
