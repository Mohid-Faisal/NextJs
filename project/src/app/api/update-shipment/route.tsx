import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    
    // Console log the received data for debugging
    console.log('=== UPDATE SHIPMENT DATA RECEIVED ===');
    console.log('Complete Request Body:', body);
    console.log('Key Fields:', {
      deliveryStatus: body.deliveryStatus,
      packaging: body.packaging,
      shippingMode: body.shippingMode,
      vendor: body.vendor,
      serviceMode: body.serviceMode,
    });
    console.log('=== END UPDATE SHIPMENT DATA ===');
    
    const {
      id,
      trackingId,
      shipmentDate,
      agency,
      office,
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      destination,
      deliveryStatus,
      shippingMode,
      packaging,
      vendor,
      serviceMode,
      amount,
      packageDescription,
      weight,
      length,
      width,
      height,
      weightVol,
      fixedCharge,
      decValue,
      price,
      discount,
      fuelSurcharge,
      insurance,
      customs,
      tax,
      declaredValue,
      reissue,
      manualRate,
      packages,
      packageTotals,
      calculatedValues,
      totalPackages,
      totalWeight,
      totalWeightVol,
      totalCost,
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
        shipmentDate: shipmentDate ? new Date(shipmentDate) : undefined,
        agency,
        office,
        senderName,
        senderAddress,
        recipientName,
        recipientAddress,
        destination,
        deliveryStatus,
        shippingMode,
        packaging,
        vendor,
        serviceMode,
        amount: amount ? parseInt(amount) : undefined,
        packageDescription,
        weight: weight ? parseFloat(weight) : undefined,
        length: length ? parseFloat(length) : undefined,
        width: width ? parseFloat(width) : undefined,
        height: height ? parseFloat(height) : undefined,
        weightVol: weightVol ? parseFloat(weightVol) : undefined,
        fixedCharge: fixedCharge ? parseFloat(fixedCharge) : undefined,
        decValue: decValue ? parseFloat(decValue) : undefined,
        price: price ? parseFloat(price) : undefined,
        discount: discount ? parseFloat(discount) : undefined,
        fuelSurcharge: fuelSurcharge ? parseFloat(fuelSurcharge) : undefined,
        insurance: insurance ? parseFloat(insurance) : undefined,
        customs: customs ? parseFloat(customs) : undefined,
        tax: tax ? parseFloat(tax) : undefined,
        declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
        reissue: reissue ? parseFloat(reissue) : undefined,
        totalCost: calculatedTotalCost,
        manualRate: manualRate !== undefined ? Boolean(manualRate) : undefined,
        totalPackages: totalPackages ? parseInt(totalPackages) : undefined,
        totalWeight: totalWeight ? parseFloat(totalWeight) : undefined,
        totalWeightVol: totalWeightVol ? parseFloat(totalWeightVol) : undefined,
        packages: packages ? JSON.stringify(packages) : undefined,
        packageTotals: packageTotals ? JSON.stringify(packageTotals) : undefined,
        calculatedValues: calculatedValues ? JSON.stringify(calculatedValues) : undefined,
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
