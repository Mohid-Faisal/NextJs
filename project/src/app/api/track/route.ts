import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit";
import { verifyTrackingToken } from "@/lib/trackingToken";

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

/**
 * PUBLIC tracking endpoint.
 *
 * SECURITY: previously returned the ENTIRE shipment row (internal costs,
 * vendor cost, profit margin, full addresses) plus the full recipient record,
 * with no rate limiting, and performed unauthenticated database writes.
 *
 * Now returns an explicit allow-list of public fields only, never writes,
 * and is rate limited against tracking-ID enumeration.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`track:${ip}`, 30, 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit);

    const { searchParams } = new URL(request.url);

    // Two lookup paths:
    //  ?t=<signed-token>  — unguessable, expiring link (QR codes, emails)
    //  ?bookingId=<id>    — direct lookup (rate limited against enumeration)
    const signedToken = searchParams.get("t")?.trim() ?? "";
    const signedId = signedToken ? verifyTrackingToken(signedToken) : null;
    const bookingId = signedId ?? searchParams.get("bookingId")?.trim();

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
      },
      select: {
        id: true,
        organizationId: true,
        trackingId: true,
        invoiceNumber: true,
        destination: true,
        deliveryStatus: true,
        trackingStatus: true,
        trackingStatusHistory: true,
        shippingMode: true,
        serviceMode: true,
        packaging: true,
        shipmentDate: true,
        deliveryTime: true,
        weight: true,
        totalWeight: true,
        totalPackages: true,
        amount: true,
        packageDescription: true,
        recipientName: true,
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

    // Look up recipient — only minimal public contact fields are exposed.
    let recipient: { CompanyName: string; PersonName: string; City?: string; Country?: string } | null = null;
    if (shipment.recipientName) {
      const name = String(shipment.recipientName).trim();
      if (name) {
        const match =
          (await prisma.recipients.findFirst({
            where: { organizationId: shipment.organizationId, CompanyName: { equals: name } },
            select: { CompanyName: true, PersonName: true, City: true, Country: true },
          })) ||
          (await prisma.recipients.findFirst({
            where: { organizationId: shipment.organizationId, PersonName: { equals: name } },
            select: { CompanyName: true, PersonName: true, City: true, Country: true },
          })) ||
          (await prisma.recipients.findFirst({
            where: {
              organizationId: shipment.organizationId,
              OR: [
                { CompanyName: { contains: name } },
                { PersonName: { contains: name } },
              ],
            },
            select: { CompanyName: true, PersonName: true, City: true, Country: true },
          }));
        recipient = match;
      }
    }

      const res = NextResponse.json({
        success: true,
        shipment: {
          trackingId: shipment.trackingId,
          invoiceNumber: shipment.invoiceNumber,
          destination: shipment.destination,
          deliveryStatus: shipment.deliveryStatus,
          trackingStatus: shipment.trackingStatus,
          trackingStatusHistory: parseHistory(shipment.trackingStatusHistory ?? []),
          shippingMode: shipment.shippingMode,
          serviceMode: shipment.serviceMode,
          packaging: shipment.packaging,
          shipmentDate: shipment.shipmentDate,
          deliveryTime: shipment.deliveryTime,
          totalWeight: shipment.totalWeight ?? shipment.weight,
          amount: shipment.amount,
          packageDescription: shipment.packageDescription,
        },
        recipient,
        organization: org ? { name: org.name, logoUrl: org.logoUrl } : null
      });
      // Public, non-sensitive payload — short shared-cache window absorbs
      // repeated polling and QR rescans without hitting the database.
      res.headers.set("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");
      return res;
    } catch (error) {
    console.error("Public track API error:", error);
    return NextResponse.json(
      { error: "An error occurred while tracking. Please try again." },
      { status: 500 }
    );
  }
}
