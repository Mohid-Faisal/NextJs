import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { getJwtSecretString } from "@/lib/auth/jwtSecret";

const PURPOSE = "plan-selection";
export const PLAN_SELECTION_COOKIE = "plan_selection";
const MAX_AGE_SECONDS = 2 * 60 * 60;

function secretKey() {
  return new TextEncoder().encode(getJwtSecretString());
}

export async function signPlanSelectionToken(userId: number): Promise<string> {
  return new SignJWT({ userId, purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyPlanSelectionToken(token: string): Promise<number> {
  const { payload } = await jwtVerify(token, secretKey());
  if (payload.purpose !== PURPOSE || typeof payload.userId !== "number") {
    throw new Error("Invalid plan selection token");
  }
  return payload.userId;
}

export function attachPlanSelectionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(PLAN_SELECTION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return res;
}

export function clearPlanSelectionCookie(res: NextResponse): NextResponse {
  res.cookies.set(PLAN_SELECTION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
