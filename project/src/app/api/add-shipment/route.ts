import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const {
      trackingId,
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      destination,
      paymentMethod,
      totalCost,
      status,
      invoiceStatus,
    } = await req.json();

    // Basic validation
    const requiredFields = [
      "trackingId",
      "senderName",
      "senderAddress",
      "recipientName",
      "recipientAddress",
      "destination",
      "paymentMethod",
      "totalCost",
      "status",
      "invoiceStatus",
    ];

    const existingShipment = await prisma.shipment.findUnique({
      where: {
        trackingId,
      },
    });
    
    if (existingShipment) {
      return NextResponse.json(
        { success: false, message: "Shipment already exists." },
        { status: 400 }
      );
    }

    for (const field of requiredFields) {
      if (!eval(field)) {
        return NextResponse.json(
          { success: false, message: `${field} is required.` },
          { status: 400 }
        );
      }
    }

    // Store shipment in the database
    const shipment = await prisma.shipment.create({
      data: {
        trackingId,
        senderName,
        senderAddress,
        recipientName,
        recipientAddress,
        destination,
        paymentMethod,
        totalCost: parseFloat(totalCost),
        status,
        invoiceStatus,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Shipment added successfully.",
      shipment,
    });
  } catch (error) {
    console.error("Add shipment error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add shipment." },
      { status: 500 }
    );
  }
}
