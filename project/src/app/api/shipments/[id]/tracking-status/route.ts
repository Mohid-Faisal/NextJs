import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TRACKING_STATUSES = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"] as const;

export type TrackingHistoryEntry = {
  status: string;
  timestamp: string; // ISO
  description?: string;
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id, 10);

    if (isNaN(shipmentId)) {
      return NextResponse.json({ success: false, error: "Invalid shipment ID" }, { status: 400 });
    }

    const body = await request.json();
    const {
      status,
      timestamp,
      description = "",
    } = body as { status?: string; timestamp?: string; description?: string };

    if (!status || typeof status !== "string") {
      return NextResponse.json(
        { success: false, error: "status is required" },
        { status: 400 }
      );
    }

    if (!TRACKING_STATUSES.includes(status as (typeof TRACKING_STATUSES)[number])) {
      return NextResponse.json(
        { success: false, error: `status must be one of: ${TRACKING_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return NextResponse.json({ success: false, error: "Shipment not found" }, { status: 404 });
    }

    const occurredAt = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(occurredAt.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid timestamp" }, { status: 400 });
    }

    const existing = parseHistory((shipment as { trackingStatusHistory?: unknown }).trackingStatusHistory ?? []);
    const entry: TrackingHistoryEntry = {
      status,
      timestamp: occurredAt.toISOString(),
      description: typeof description === "string" ? description : "",
    };
    const nextHistory = [...existing, entry];

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingStatusHistory: nextHistory as unknown as object,
        trackingStatus: status,
      } as Record<string, unknown>,
    });

    return NextResponse.json({ success: true, history: nextHistory });
  } catch (error) {
    console.error("Error updating tracking status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update tracking status" },
      { status: 500 }
    );
  }
}
