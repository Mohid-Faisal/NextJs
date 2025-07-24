import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      trackingId,
      senderName,
      recipientName,
      destination,
      paymentMethod,
      totalCost,
      status,
      invoiceStatus,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing shipment ID" }, { status: 400 });
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: {
        trackingId,
        senderName,
        recipientName,
        destination,
        paymentMethod,
        totalCost: totalCost !== "" ? parseFloat(totalCost) : undefined,
        status,
        invoiceStatus,
      },
    });

    return NextResponse.json({ success: true, shipment: updatedShipment });
  } catch (error) {
    console.error("Error updating shipment:", error);
    return NextResponse.json({ success: false, message: "Failed to update shipment" }, { status: 500 });
  }
}
