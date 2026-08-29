import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_billing");
    if (auth.error) return auth.error;
    const session = auth.session;

    // Find all payments with a non-empty reference
    const payments = await prisma.payment.findMany({
      where: orgWhere(session, {
        reference: { not: null },
      }),
      orderBy: { id: "asc" },
      select: {
        id: true,
        reference: true,
        date: true,
      },
    });

    const seenRefs = new Map<string, number>(); // ref -> count
    const updatedRecords: { id: number; oldRef: string; newRef: string }[] = [];

    for (const payment of payments) {
      const ref = (payment.reference ?? "").trim();
      if (!ref) continue;

      if (!seenRefs.has(ref)) {
        // First occurrence: keep as is
        seenRefs.set(ref, 1);
      } else {
        // Duplicate occurrence: append suffix -1, -2, etc.
        const currentCount = seenRefs.get(ref)!;
        seenRefs.set(ref, currentCount + 1);

        let newRef = `${ref}-${currentCount}`;
        // Ensure newRef doesn't collide with existing refs
        let attempt = 1;
        while (payments.some((p) => (p.reference ?? "").trim() === newRef)) {
          newRef = `${ref}-${currentCount + attempt}`;
          attempt++;
        }

        await prisma.payment.update({
          where: { id: payment.id },
          data: { reference: newRef },
        });

        updatedRecords.push({
          id: payment.id,
          oldRef: ref,
          newRef,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${payments.length} payments. Updated ${updatedRecords.length} duplicate references.`,
      updatedCount: updatedRecords.length,
      updatedRecords,
    });
  } catch (error) {
    console.error("Fix duplicate references error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fix duplicate references." },
      { status: 500 }
    );
  }
}
