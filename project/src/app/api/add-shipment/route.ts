import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const requestBody = await req.json();
    
    // Extract basic required fields
    const {
      shippingPrefix,
      awbNumber,
      agency,
      office,
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      destination,
      deliveryTime,
      invoiceStatus,
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
    } = requestBody;
    
    // Console log all the collected data
    console.log('=== SHIPMENT DATA RECEIVED ===');
    console.log('Basic Form Data:', {
      shippingPrefix,
      awbNumber,
      agency,
      office,
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      destination,
      deliveryTime,
      invoiceStatus,
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
    });
    
    console.log('AWB Information:', {
      awbNumber: shippingPrefix + awbNumber,
    });
    
    console.log('Destination Information:', {
      finalDestination: destination,
    });
    
    console.log('Package Information:', {
      packages: packages,
      packageTotals: packageTotals,
      totalPackages: totalPackages,
      totalWeight: totalWeight,
      totalWeightVol: totalWeightVol,
    });
    
    console.log('Calculated Values:', calculatedValues);
    
    console.log('Additional Metadata:', {
      manualRate: manualRate,
      vendor: vendor,
      serviceMode: serviceMode,
    });
    
    console.log('Complete Request Body:', requestBody);
    console.log('=== END SHIPMENT DATA ===');

    // Basic validation
    const requiredFields = [
      "awbNumber",
      "senderName",
      "senderAddress",
      "recipientName",
      "recipientAddress",
      "destination",
    ];

    // Validate AWB number
    if (!awbNumber || awbNumber.trim() === '') {
      return NextResponse.json(
        { success: false, message: "AWB Number is required." },
        { status: 400 }
      );
    }

    // Combine shipping prefix and AWB number
    const fullAwbNumber = (shippingPrefix || 'AWB') + awbNumber;

    // Validate destination
    if (!destination || destination.trim() === '') {
      return NextResponse.json(
        { success: false, message: "Destination is required." },
        { status: 400 }
      );
    }

    // Check if shipment with this AWB number already exists
    const existingShipment = await prisma.shipment.findFirst({
      where: {
        awbNumber: fullAwbNumber,
      },
    });
    
    if (existingShipment) {
      return NextResponse.json(
        { success: false, message: "Shipment with this AWB number already exists." },
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

    // Calculate total cost: price + fuelSurcharge - percentage discount
    const originalPrice = parseFloat(price) || 0;
    const fuelSurchargeAmount = parseFloat(fuelSurcharge) || 0;
    const discountPercentage = parseFloat(discount) || 0;
    
    // Calculate discount amount as percentage of original price
    const discountAmount = (originalPrice * discountPercentage) / 100;
    const totalCost = originalPrice + fuelSurchargeAmount - discountAmount;

    // Get subtotal from calculated values or use original price
    const subtotal = calculatedValues?.subtotal || originalPrice;

    // Generate tracking ID (you can customize this logic)
    const timestamp = Date.now();
    const trackingId = `TRK${timestamp}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Store shipment in the database with all fields
    const shipment = await prisma.shipment.create({
      data: {
        trackingId,
        awbNumber: fullAwbNumber,
        agency,
        office,
        senderName,
        senderAddress,
        recipientName,
        recipientAddress,
        destination,
        deliveryTime,
        invoiceStatus,
        deliveryStatus,
        shippingMode,
        packaging,
        vendor,
        serviceMode,
        amount: parseInt(amount) || 1,
        packageDescription,
        weight: parseFloat(weight) || 0,
        length: parseFloat(length) || 0,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0,
        weightVol: parseFloat(weightVol) || 0,
        fixedCharge: parseFloat(fixedCharge) || 0,
        decValue: parseFloat(decValue) || 0,
        price: originalPrice,
        discount: discountPercentage,
        fuelSurcharge: fuelSurchargeAmount,
        insurance: parseFloat(insurance) || 0,
        customs: parseFloat(customs) || 0,
        tax: parseFloat(tax) || 0,
        declaredValue: parseFloat(declaredValue) || 0,
        reissue: parseFloat(reissue) || 0,
        totalCost,
        subtotal,
        manualRate: Boolean(manualRate),
        totalPackages: parseInt(totalPackages) || 0,
        totalWeight: parseFloat(totalWeight) || 0,
        totalWeightVol: parseFloat(totalWeightVol) || 0,
        packages: packages ? JSON.stringify(packages) : undefined,
        packageTotals: packageTotals ? JSON.stringify(packageTotals) : undefined,
        calculatedValues: calculatedValues ? JSON.stringify(calculatedValues) : undefined,
      },
    });
    
    console.log('Shipment saved to database:', {
      id: shipment.id,
      trackingId: shipment.trackingId,
      awbNumber: shipment.awbNumber,
      destination: shipment.destination,
      totalCost: shipment.totalCost,
      subtotal: shipment.subtotal,
      totalPackages: shipment.totalPackages,
      totalWeight: shipment.totalWeight,
      createdAt: shipment.createdAt,
    });

    return NextResponse.json({
      success: true,
      message: "Shipment added successfully.",
      shipment,
      calculation: {
        originalPrice,
        fuelSurcharge: fuelSurchargeAmount,
        discountPercentage: discountPercentage,
        discountAmount: discountAmount,
        totalCost,
        subtotal,
      },
      receivedData: {
        trackingId: trackingId,
        awbNumber: fullAwbNumber,
        destination: destination,
        totalPackages: totalPackages,
        totalWeight: totalWeight,
        totalWeightVol: totalWeightVol,
        calculatedValues: calculatedValues,
      },
    });
  } catch (error) {
    console.error("Add shipment error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add shipment." },
      { status: 500 }
    );
  }
}
