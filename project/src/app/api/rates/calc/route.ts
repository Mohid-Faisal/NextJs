import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { lookupVendorRate } from "@/lib/server/ledger";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json();
    const {
      weight,
      vendor,
      serviceMode,
      destination,
      fuelSurcharge = 0,
      discount = 0,
      packaging,
      profitPercentage = 0,
    } = body;

    if (!weight) {
      return NextResponse.json(
        { error: "Weight is required." },
        { status: 400 }
      );
    }

    const weightNumber = parseFloat(weight);
    if (isNaN(weightNumber) || weightNumber <= 0) {
      return NextResponse.json(
        { error: "Weight must be a valid positive number." },
        { status: 400 }
      );
    }

    if (!destination) {
      return NextResponse.json(
        { error: "Destination is required." },
        { status: 400 }
      );
    }

    const rateMatch = await lookupVendorRate(prisma, {
      organizationId: session.organizationId,
      vendor,
      serviceMode,
      destination,
      packaging,
      weight: weightNumber,
    });

    if (!rateMatch || rateMatch.vendorPrice <= 0) {
      let errorMessage = `No rates found for destination: ${destination} and weight: ${weightNumber}kg`;
      if (vendor && String(vendor).trim() !== "") {
        errorMessage += `, vendor: ${vendor}`;
      }
      if (serviceMode && String(serviceMode).trim() !== "") {
        errorMessage += `, service: ${serviceMode}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    const originalPrice = rateMatch.vendorPrice;
    const vendorPrice = rateMatch.vendorPrice;
    const fixedChargeAmount = rateMatch.fixedCharge || 0;
    const fuelSurchargeAmount = parseFloat(String(fuelSurcharge)) || 0;
    const discountPercentage = parseFloat(String(discount)) || 0;
    const profitPct = parseFloat(String(profitPercentage)) || 0;

    // Calculate discount amount as percentage of original price
    const discountAmount = (originalPrice * discountPercentage) / 100;
    const originalCost =
      originalPrice + fuelSurchargeAmount - discountAmount + fixedChargeAmount;

    const profitPercentageAmount = (originalCost * profitPct) / 100;
    const totalCost = originalCost + profitPercentageAmount;

    const result = {
      success: true,
      price: originalPrice,
      weight: rateMatch.weight,
      service: rateMatch.service,
      vendor: rateMatch.vendor,
      zone: rateMatch.zone,
      fuelSurcharge: fuelSurchargeAmount,
      discountPercentage,
      discountAmount,
      originalCost,
      profitPercentage: profitPct,
      profitPercentageAmount,
      totalCost,
      fixedCharge: fixedChargeAmount,
      vendorPrice,
      calculation: {
        originalPrice,
        fuelSurcharge: fuelSurchargeAmount,
        discountPercentage,
        discountAmount,
        totalCost,
        fixedCharge: fixedChargeAmount,
        vendorPrice,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ Error calculating rate:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
