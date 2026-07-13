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

  // Exclude static assets, auth pages, and API routes
  const isAuthPage = pathname.startsWith("/auth");
  const isApiRoute = pathname.startsWith("/api");
  const isStaticFile = pathname.includes(".");

  if (isAuthPage || isApiRoute || isStaticFile) {
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

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
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
    const loginUrl = new URL("/auth/login", req.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("token");
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - auth (authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Files with extension (e.g. .*\\..*$)
     */
    "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
