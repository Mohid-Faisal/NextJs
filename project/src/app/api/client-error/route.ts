import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/lib/logger";

/** Client-side error reports from `error.tsx`. Message is truncated. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message =
      typeof body?.message === "string" ? body.message.slice(0, 500) : "client error";
    const digest = typeof body?.digest === "string" ? body.digest.slice(0, 64) : undefined;
    await reportError(new Error(message), {
      source: "client",
      digest,
    });
  } catch {
    // Never fail the UI because reporting failed.
  }
  return NextResponse.json({ ok: true });
}
