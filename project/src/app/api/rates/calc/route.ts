import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { weight, vendor, serviceMode, destination } = body;

    console.log('Rate calculation API received request:', {
      weight,
      vendor,
      serviceMode,
      destination,
      fullBody: body
    });



    if (!weight) {
      return NextResponse.json(
        {
          error: "Weight is required.",
        },
        { status: 400 }
      );
    }

    const weightNumber = parseFloat(weight);
    if (isNaN(weightNumber) || weightNumber <= 0) {
      return NextResponse.json(
        {
          error: "Weight must be a valid positive number.",
        },
        { status: 400 }
      );
    }

    // Validate required parameters
    if (!destination) {
      return NextResponse.json(
        {
          error: "Destination is required.",
        },
        { status: 400 }
      );
    }

    const finalDestination = destination;
    const docType = "Non Document";

    // Step 1: Find all zones for the destination country
    const zoneInfos = await prisma.zone.findMany({
      where: {
        country: {
          contains: finalDestination,
          mode: "insensitive",
        },
        service: serviceMode
      },
      select: {
        zone: true,
        country: true,
        service: true,
      },
    });

    console.log('Found zones for destination:', {
      destination: finalDestination,
      zoneCount: zoneInfos.length,
      zones: zoneInfos
    });

    // If no zones found, return appropriate error
    if (zoneInfos.length === 0) {
      return NextResponse.json(
        {
          error: `No zones found for destination: ${finalDestination}. Please check the destination country name.`,
        },
        { status: 404 }
      );
    }

    // Step 2: Extract unique zone numbers for this destination
    const destinationZones = new Set();
    zoneInfos.forEach((zoneInfo) => {
      let zoneNumber: number;
      if (typeof zoneInfo.zone === "string") {
        const zoneMatch = zoneInfo.zone.match(/\d+/);
        if (zoneMatch) {
          zoneNumber = parseInt(zoneMatch[0]);
        } else {
          console.log(`⚠️ No numeric value found in zone: ${zoneInfo.zone}`);
          return;
        }
      } else {
        zoneNumber = parseInt(zoneInfo.zone);
      }

      if (!isNaN(zoneNumber)) {
        destinationZones.add(zoneNumber);
        (zoneInfo as any).zone = zoneNumber;
      }
    });

    // Step 3: For each zone, find which services are available and get their rates
    const allRates = [];
    const bestRates = [];

    console.log('Processing zones:', {
      totalZones: destinationZones.size,
      zones: Array.from(destinationZones),
      weight: weightNumber,
      docType: docType,
      targetVendor: vendor,
      targetService: serviceMode
    });

    for (const zoneNumber of destinationZones) {
      console.log(`Processing zone ${zoneNumber}...`);
      
      // Build the where clause for rates query
      const rateWhereClause: any = {
        zone: zoneNumber as number,
        docType: docType,
        weight: weightNumber
      };

      // Filter by vendor if provided
      if (vendor && vendor.trim() !== '') {
        rateWhereClause.vendor = vendor;
      }

      // Filter by service if provided
      if (serviceMode && serviceMode.trim() !== '') {
        rateWhereClause.service = serviceMode;
      }

      console.log('Rate query where clause:', rateWhereClause);

      // Find rates for this zone with the specified filters
      const serviceRates = await prisma.rate.findMany({
        where: rateWhereClause,
        orderBy: {
          weight: "asc",
        },
      });

      console.log(`Zone ${zoneNumber} rates found:`, {
        count: serviceRates.length,
        rates: serviceRates.map(r => ({
          vendor: r.vendor,
          service: r.service,
          weight: r.weight,
          price: r.price
        }))
      });

      if (serviceRates.length === 0) {
        console.log(`No rates found for zone ${zoneNumber} with specified filters`);
        continue;
      }

      // Find the best rate for this zone (lowest weight that covers the requested weight)
      const bestServiceRate = serviceRates[0]; // Already sorted by weight

      bestRates.push({
        zone: zoneNumber,
        country:
          zoneInfos.find((z) => {
            let zNum: number;
            if (typeof z.zone === "string") {
              const match = z.zone.match(/\d+/);
              zNum = match ? parseInt(match[0]) : 0;
            } else {
              zNum = parseInt(z.zone);
            }
            return zNum === zoneNumber;
          })?.country || "Unknown",
        service: bestServiceRate.service,
        bestRate: {
          weight: bestServiceRate.weight,
          price: bestServiceRate.price,
          vendor: bestServiceRate.vendor,
        },
        allRates: serviceRates.map((rate) => ({
          weight: rate.weight,
          price: rate.price,
          vendor: rate.vendor,
        })),
      });

      allRates.push(...serviceRates);
    }

    console.log('All rates found:', {
      count: allRates.length,
      rates: allRates.map(r => ({
        vendor: r.vendor,
        service: r.service,
        weight: r.weight,
        price: r.price
      }))
    });

    if (allRates.length === 0) {
      let errorMessage = `No rates found for destination: ${finalDestination} and weight: ${weightNumber}kg`;
      
      if (vendor && vendor.trim() !== '') {
        errorMessage += `, vendor: ${vendor}`;
      }
      
      if (serviceMode && serviceMode.trim() !== '') {
        errorMessage += `, service: ${serviceMode}`;
      }
      
      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: 404 }
      );
    }

    // Find the best overall rate from all rates (lowest price)
    const bestOverallRate = allRates.reduce((best, current) => {
      return current.price < best.price ? current : best;
    });

    const result = {
      success: true,
      price: bestOverallRate.price,
      weight: bestOverallRate.weight,
      service: bestOverallRate.service,
      vendor: bestOverallRate.vendor,
      zone: bestOverallRate.zone,
    };

    console.log('Rate calculation result:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ Error calculating rate:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
} 