import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  console.log("🔐 Middleware HIT for:", pathname);

  const isProtected = pathname.startsWith("/dashboard");

  if (isProtected) {
    if (!token) {
      console.log("❌ No token found, redirecting...");
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      await jwtVerify(token, secret);
      console.log("✅ Token verified");
      return NextResponse.next();
    } catch (err) {
      console.log("❌ Invalid token:", err);
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
