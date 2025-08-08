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
      totalCost,
      price,
      fuelSurcharge,
      discount,
      status,
      invoiceStatus,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing shipment ID" }, { status: 400 });
    }

    let calculatedTotalCost: number;

    // Handle both old format (totalCost) and new format (price + fuelSurcharge - percentage discount)
    if (price !== undefined || fuelSurcharge !== undefined || discount !== undefined) {
      // New format: calculate from price, fuelSurcharge, percentage discount
      const originalPrice = parseFloat(price) || 0;
      const fuelSurchargeAmount = parseFloat(fuelSurcharge) || 0;
      const discountPercentage = parseFloat(discount) || 0;
      
      // Calculate discount amount as percentage of original price
      const discountAmount = (originalPrice * discountPercentage) / 100;
      calculatedTotalCost = originalPrice + fuelSurchargeAmount - discountAmount;
    } else if (totalCost !== undefined) {
      // Old format: use totalCost directly
      calculatedTotalCost = parseFloat(totalCost) || 0;
    } else {
      // No cost information provided
      calculatedTotalCost = 0;
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: {
        trackingId,
        senderName,
        recipientName,
        destination,
        totalCost: calculatedTotalCost,
        status,
        invoiceStatus,
      },
    });

    return NextResponse.json({ 
      success: true, 
      shipment: updatedShipment,
      calculation: price !== undefined ? {
        originalPrice: parseFloat(price) || 0,
        fuelSurcharge: parseFloat(fuelSurcharge) || 0,
        discountPercentage: parseFloat(discount) || 0,
        discountAmount: (parseFloat(price) || 0) * (parseFloat(discount) || 0) / 100,
        totalCost: calculatedTotalCost,
      } : undefined,
    });
  } catch (error) {
    console.error("Error updating shipment:", error);
    return NextResponse.json({ success: false, message: "Failed to update shipment" }, { status: 500 });
  }
}
