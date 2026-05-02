import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runApxLogisticsAutoPay } from "@/lib/accounts/skynetVendorAutoPay";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = parseInt(String(body.vendorId ?? ""), 10);

    const outcome = await runApxLogisticsAutoPay(prisma, vendorId);

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json(outcome.data);
  } catch (error) {
    console.error("vendor-apx-auto-pay:", error);
    return NextResponse.json(
      { error: "Failed to run automatic APX Logistics payments" },
      { status: 500 }
    );
  }
}
