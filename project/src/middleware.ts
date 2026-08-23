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

  // Exclude static assets, auth pages, and API routes
  const isAuthPage = pathname.startsWith("/auth");
  const isApiRoute = pathname.startsWith("/api");
  const isStaticFile = pathname.includes(".");

  // Allowed public pages that don't require login (only tracking)
  const isPublicPage = pathname.startsWith("/tracking");

  if (isAuthPage || isApiRoute || isStaticFile) {
    return NextResponse.next();
  }

  if (!token) {
    if (isPublicPage) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    const claims = payload as TokenPayload;

    // Best-effort UX check only. Authoritative suspension enforcement lives
    // server-side in getSession() (lib/auth/session.ts).
    if (claims.orgStatus === "suspended") {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("error", "org-suspended");
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("token");
      return res;
    }

    const isUnusedPublicPage =
      pathname === "/" ||
      pathname.startsWith("/about") ||
      pathname.startsWith("/contact") ||
      pathname.startsWith("/services") ||
      pathname.startsWith("/tools") ||
      pathname.startsWith("/rate-calculator");

    if (isUnusedPublicPage) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch {
    if (isPublicPage) {
      const res = NextResponse.next();
      res.cookies.delete("token");
      return res;
    }
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
