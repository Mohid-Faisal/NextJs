import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { withAuth } from "@/lib/api/withAuth";
import { buildTrackingUrl } from "@/lib/trackingToken";

/**
 * GET /api/shipments/[id]/tracking-link
 * Returns a signed, expiring public tracking URL for a shipment belonging
 * to the caller's organization. Safe to print on waybills / QR codes.
 */
export const GET = withAuth<{ }, { id: string }>(
  { permission: "view_shipments" },
  async ({ session, params }) => {
    const shipmentId = parseInt(params.id, 10);
    if (isNaN(shipmentId)) {
      return NextResponse.json({ success: false, error: "Invalid shipment ID" }, { status: 400 });
    }

    const shipment = await prisma.shipment.findFirst({
      where: orgWhere(session, { id: shipmentId }),
      select: { trackingId: true, invoiceNumber: true },
    });

    if (!shipment) {
      return NextResponse.json({ success: false, error: "Shipment not found" }, { status: 404 });
    }

    const publicId = shipment.trackingId || shipment.invoiceNumber;
    if (!publicId) {
      return NextResponse.json(
        { success: false, error: "Shipment has no tracking or booking reference yet" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      trackingId: publicId,
      url: buildTrackingUrl(publicId),
    });
  }
);
