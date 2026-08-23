import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

type TokenPayload = {
  organizationId?: number;
  orgStatus?: string;
};

/**
 * SECURITY: fail closed when JWT_SECRET is missing — never fall back to a
 * known constant (token forgery risk).
 */
function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "your-secret-key") {
    throw new Error(
      "JWT_SECRET is not configured. Set a strong random JWT_SECRET environment variable."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  // Static assets, auth pages, and API routes pass through
  const isAuthPage = pathname.startsWith("/auth") || pathname === "/login" || pathname === "/signup";
  const isApiRoute = pathname.startsWith("/api");
  const isStaticFile = pathname.includes(".");
  const isDashboard = pathname.startsWith("/dashboard");

  if (isAuthPage || isApiRoute || isStaticFile) {
    // If logged in and visiting login page, redirect to dashboard
    if (token && (pathname === "/auth/login" || pathname === "/login")) {
      try {
        await jwtVerify(token, getJwtSecretKey());
        return NextResponse.redirect(new URL("/dashboard", req.url));
      } catch {
        // Token invalid, allow login page
        return NextResponse.next();
      }
    }
    return NextResponse.next();
  }

  // Protected route enforcement: only dashboard requires authentication
  if (isDashboard) {
    if (!token) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const { payload } = await jwtVerify(token, getJwtSecretKey());
      const claims = payload as TokenPayload;

      // Check organization status
      if (claims.orgStatus === "suspended") {
        const loginUrl = new URL("/auth/login", req.url);
        loginUrl.searchParams.set("error", "org-suspended");
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete("token");
        return res;
      }

      return NextResponse.next();
    } catch {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("token");
      return res;
    }
  }

  // All public marketing and info pages are open to everyone
  return NextResponse.next();
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
