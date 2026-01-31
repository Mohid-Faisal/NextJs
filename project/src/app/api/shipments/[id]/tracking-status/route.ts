import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TRACKING_STATUSES = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"] as const;

export type TrackingHistoryEntry = {
  status: string;
  timestamp: string; // ISO
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

function getLatestStatus(history: TrackingHistoryEntry[]): string | null {
  if (history.length === 0) return null;
  const sorted = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return sorted[0]?.status ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id, 10);
    if (isNaN(shipmentId)) {
      return NextResponse.json({ success: false, error: "Invalid shipment ID" }, { status: 400 });
    }
    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return NextResponse.json({ success: false, error: "Shipment not found" }, { status: 404 });
    }
    const history = parseHistory((shipment as { trackingStatusHistory?: unknown }).trackingStatusHistory ?? []);
    const sorted = [...history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return NextResponse.json({ success: true, history: sorted });
  } catch (error) {
    console.error("Error fetching tracking history:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tracking history" },
      { status: 500 }
    );
  }
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
      location = "",
    } = body as { status?: string; timestamp?: string; description?: string; location?: string };

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
      location: typeof location === "string" ? location.trim() || undefined : undefined,
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

export async function PUT(
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
      index,
      status,
      timestamp,
      description = "",
      location = "",
    } = body as {
      index?: number;
      status?: string;
      timestamp?: string;
      description?: string;
      location?: string;
    };
    if (typeof index !== "number" || index < 0) {
      return NextResponse.json({ success: false, error: "Valid index is required" }, { status: 400 });
    }
    if (!status || typeof status !== "string") {
      return NextResponse.json({ success: false, error: "status is required" }, { status: 400 });
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
    const existing = parseHistory((shipment as { trackingStatusHistory?: unknown }).trackingStatusHistory ?? []);
    if (index >= existing.length) {
      return NextResponse.json({ success: false, error: "Index out of range" }, { status: 400 });
    }
    const occurredAt = timestamp ? new Date(timestamp) : new Date(existing[index].timestamp);
    if (isNaN(occurredAt.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid timestamp" }, { status: 400 });
    }
    const updated: TrackingHistoryEntry = {
      status,
      timestamp: occurredAt.toISOString(),
      description: typeof description === "string" ? description : "",
      location: typeof location === "string" ? location.trim() || undefined : undefined,
    };
    const nextHistory = existing.map((e, i) => (i === index ? updated : e));
    const latest = getLatestStatus(nextHistory);
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingStatusHistory: nextHistory as unknown as object,
        ...(latest != null && { trackingStatus: latest }),
      } as Record<string, unknown>,
    });
    return NextResponse.json({ success: true, history: nextHistory });
  } catch (error) {
    console.error("Error editing tracking status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to edit tracking status" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const { index } = body as { index?: number };
    if (typeof index !== "number" || index < 0) {
      return NextResponse.json({ success: false, error: "Valid index is required" }, { status: 400 });
    }
    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return NextResponse.json({ success: false, error: "Shipment not found" }, { status: 404 });
    }
    const existing = parseHistory((shipment as { trackingStatusHistory?: unknown }).trackingStatusHistory ?? []);
    if (index >= existing.length) {
      return NextResponse.json({ success: false, error: "Index out of range" }, { status: 400 });
    }
    const nextHistory = existing.filter((_, i) => i !== index);
    const latest = getLatestStatus(nextHistory);
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingStatusHistory: nextHistory as unknown as object,
        trackingStatus: latest ?? null, // clear when history is empty so tracking page reflects deletion
      } as Record<string, unknown>,
    });
    return NextResponse.json({ success: true, history: nextHistory });
  } catch (error) {
    console.error("Error deleting tracking status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete tracking status" },
      { status: 500 }
    );
  }
}
