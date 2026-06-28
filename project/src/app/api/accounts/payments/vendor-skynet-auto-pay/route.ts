import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSkynetVendorAutoPay } from "@/lib/accounts/skynetVendorAutoPay";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json().catch(() => ({}));
    const vendorId = parseInt(String(body.vendorId ?? ""), 10);

    if (!Number.isFinite(vendorId)) {
      return NextResponse.json({ error: "Valid vendorId is required" }, { status: 400 });
    }

    const vendor = await prisma.vendors.findFirst({
      where: orgWhere(session, { id: vendorId }),
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const outcome = await runSkynetVendorAutoPay(prisma, vendorId, {
      organizationId: session.organizationId,
    });

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json(outcome.data);
  } catch (error) {
    console.error("vendor-skynet-auto-pay:", error);
    return NextResponse.json(
      { error: "Failed to run automatic Skynet payments" },
      { status: 500 }
    );
  }
}
