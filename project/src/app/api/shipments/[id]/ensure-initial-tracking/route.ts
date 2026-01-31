import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TrackingHistoryEntry = {
  status: string;
  timestamp: string;
  description?: string;
  location?: string;
};

function parseHistory(raw: unknown): TrackingHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is TrackingHistoryEntry =>
      e != null &&
      typeof e === "object" &&
      "status" in e &&
      typeof (e as TrackingHistoryEntry).status === "string" &&
      "timestamp" in e &&
      typeof (e as TrackingHistoryEntry).timestamp === "string"
  );
}

/**
 * POST /api/shipments/[id]/ensure-initial-tracking
 * If the shipment has no tracking status history (e.g. created before auto-tracking),
 * adds Booked and Picked Up entries with Lahore, Pakistan and shipment-date-based times.
 * Returns the updated shipment (with invoices) for use in the tracking dialog.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id, 10);
    if (isNaN(shipmentId)) {
      return NextResponse.json({ success: false, error: "Invalid shipment ID" }, { status: 400 });
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        invoices: {
          where: { profile: "Customer" },
          select: { id: true, status: true },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ success: false, error: "Shipment not found" }, { status: 404 });
    }

    const existing = parseHistory((shipment as { trackingStatusHistory?: unknown }).trackingStatusHistory ?? []);
    if (existing.length > 0) {
      // Already has history; return as-is
      return NextResponse.json({ success: true, shipment });
    }

    const shipmentDateTime = shipment.shipmentDate
      ? new Date(shipment.shipmentDate)
      : new Date(shipment.createdAt);
    const bookingDateTime = new Date(shipmentDateTime.getTime() - 2.5 * 60 * 60 * 1000);

    const initialTrackingHistory = [
      { status: "Booked", timestamp: bookingDateTime.toISOString(), location: "Lahore, Pakistan" },
      { status: "Picked Up", timestamp: shipmentDateTime.toISOString(), location: "Lahore, Pakistan" },
    ];

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingStatusHistory: initialTrackingHistory as unknown as object,
        trackingStatus: "Picked Up",
      } as Record<string, unknown>,
      include: {
        invoices: {
          where: { profile: "Customer" },
          select: { id: true, status: true },
        },
      },
    });

    return NextResponse.json({ success: true, shipment: updated });
  } catch (error) {
    console.error("Error ensuring initial tracking:", error);
    return NextResponse.json(
      { success: false, error: "Failed to ensure initial tracking" },
      { status: 500 }
    );
  }
}
