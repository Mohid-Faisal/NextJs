import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId")?.trim();

    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID or Tracking ID is required" },
        { status: 400 }
      );
    }

    // Search for the shipment by invoiceNumber or trackingId across all organizations
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { invoiceNumber: { equals: bookingId } },
          { trackingId: { equals: bookingId } }
        ]
      }
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "No shipment found with this booking ID" },
        { status: 404 }
      );
    }

    // Retrieve organization details (logo and name)
    const org = await prisma.organization.findUnique({
      where: { id: shipment.organizationId },
      select: {
        name: true,
        logoUrl: true,
        status: true,
      }
    });

    // Check if organization is suspended
    if (org && org.status === "suspended") {
      return NextResponse.json(
        { error: "This organization's access is suspended. Please contact support." },
        { status: 403 }
      );
    }

    // Auto-populate initial tracking history if empty (e.g. legacy shipments)
    const existingHistory = parseHistory(shipment.trackingStatusHistory ?? []);
    let finalShipment = shipment;
    if (existingHistory.length === 0) {
      try {
        const shipmentDateTime = shipment.shipmentDate
          ? new Date(shipment.shipmentDate)
          : new Date(shipment.createdAt);
        const bookingDateTime = new Date(shipmentDateTime.getTime() - 2.5 * 60 * 60 * 1000);

        const initialTrackingHistory = [
          { status: "Booked", timestamp: bookingDateTime.toISOString(), location: "Lahore, Pakistan" },
          { status: "Picked Up", timestamp: shipmentDateTime.toISOString(), location: "Lahore, Pakistan" },
        ];

        finalShipment = await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            trackingStatusHistory: initialTrackingHistory as unknown as object,
            trackingStatus: "Picked Up",
          }
        });
      } catch (dbErr) {
        console.error("Failed to auto-populate initial tracking history:", dbErr);
      }
    }

    // Look up recipient details
    let recipient = null;
    if (finalShipment.recipientName) {
      const name = String(finalShipment.recipientName).trim();
      if (name) {
        recipient =
          (await prisma.recipients.findFirst({
            where: { organizationId: finalShipment.organizationId, CompanyName: { equals: name } },
          })) ||
          (await prisma.recipients.findFirst({
            where: { organizationId: finalShipment.organizationId, PersonName: { equals: name } },
          })) ||
          (await prisma.recipients.findFirst({
            where: {
              organizationId: finalShipment.organizationId,
              OR: [
                { CompanyName: { contains: name } },
                { PersonName: { contains: name } },
              ],
            },
          }));
      }
    }

    return NextResponse.json({
      success: true,
      shipment: finalShipment,
      recipient,
      organization: org ? { id: shipment.organizationId, name: org.name, logoUrl: org.logoUrl } : null
    });
  } catch (error) {
    console.error("Public track API error:", error);
    return NextResponse.json(
      { error: "An error occurred while tracking. Please try again." },
      { status: 500 }
    );
  }
}
