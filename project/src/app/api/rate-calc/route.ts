import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { origin, destination, weight, docType, height, width, length } =
      body;
    // console.log(`📍 Body:`, body);
    if (!origin || !destination || !weight || !docType) {
      return NextResponse.json(
        {
          error: "Origin, destination, weight, and document type are required.",
        },
        { status: 400 }
      );
    }

    let volume = (height * width * length) / 5000;
    let weightNumber;

    if (volume > weight) {
      weightNumber = Math.ceil(volume);
    } else {
      weightNumber = parseFloat(weight);
    }

    if (isNaN(weightNumber) || weightNumber <= 0) {
      return NextResponse.json(
        {
          error: "Weight must be a valid positive number.",
        },
        { status: 400 }
      );
    }

    // Step 1: Find all zones for the destination country
    const zoneInfos = await prisma.zone.findMany({
      where: {
        country: {
          contains: destination,
          mode: "insensitive",
        },
      },
      select: {
        zone: true,
        country: true,
        service: true,
      },
    });
    //  console.log(`📍 Zone infos:`, zoneInfos);

    if (zoneInfos.length === 0) {
      return NextResponse.json(
        {
          error: `No zones found for destination: ${destination}`,
        },
        { status: 404 }
      );
    }

    //  console.log(`📍 Found ${zoneInfos.length} zones for destination: ${destination}`);

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
    //  console.log(`📍 zoneInfos:`, zoneInfos);
    //  console.log(`📍 Destination zones:`, Array.from(destinationZones));

    // Step 3: For each zone, find which services are available and get their rates
    const allRates = [];
    const bestRates = [];

    for (const zoneNumber of destinationZones) {
      // console.log(`📍 Processing zone ${zoneNumber}`);

      // First, find which services are available in this zone for the given document type
      const availableServices = await prisma.rate.findMany({
        where: {
          zone: zoneNumber as number,
          docType: docType,
          weight: {
            gte: weightNumber,
          },
        },
        select: {
          service: true,
        },
        distinct: ["service"],
      });

      if (availableServices.length === 0) {
        // console.log(`⚠️ No services available for zone ${zoneNumber}, skipping...`);
        continue;
      }

      // console.log(`📍 Available services for zone ${zoneNumber}:`, availableServices.map(s => s.service));

      // For each available service in this zone, get the rates
      for (const serviceData of availableServices) {
        const serviceName = serviceData.service;
        console.log(
          `📍 Processing service ${serviceName} for zone ${zoneNumber}`
        );

        // Get all rates for this specific zone, service, document type, and weight
        const serviceRates = await prisma.rate.findMany({
          where: {
            zone: zoneNumber as number,
            service: serviceName,
            docType: docType,
            weight: {
              gte: weightNumber,
            },
          },
          orderBy: {
            weight: "asc",
          },
        });

        // console.log(`📍 Service rates:`, serviceRates);

        if (serviceRates.length === 0) {
          console.log(
            `⚠️ No rates found for zone ${zoneNumber}, service ${serviceName}, skipping...`
          );
          continue;
        }

        // console.log(`📍 Found ${serviceRates.length} rates for zone ${zoneNumber}, service ${serviceName}`);

        // Find the best rate for this service (lowest weight that covers the requested weight)
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
          service: serviceName,
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
    }

    //      console.log(`📍 All rates:`, allRates);
    const filteredRates = allRates.filter((rate) => {
      return zoneInfos.some((zoneInfo) => {
        return (
          rate.zone === (zoneInfo as any).zone &&
          rate.service.toLowerCase() === zoneInfo.service.toLowerCase() &&
          rate.weight === weightNumber
        );
      });
    });

    //  console.log("✅ Filtered Rates:", filteredRates);

    if (filteredRates.length === 0) {
      return NextResponse.json(
        {
          error: `No rates found for destination: ${destination}, document type: ${docType}, and weight: ${weightNumber}kg`,
        },
        { status: 404 }
      );
    }

    // Group filtered rates by zone and service to create zones data
    const zonesMap = new Map<string, any>();
    filteredRates.forEach((rate) => {
      const key = `${rate.zone}-${rate.service}`;
      if (!zonesMap.has(key)) {
        zonesMap.set(key, {
          zone: rate.zone,
          country:
            zoneInfos.find((z) => (z as any).zone === rate.zone)?.country ||
            "Unknown",
          service: rate.service,
          bestRate: {
            weight: rate.weight,
            price: rate.price,
            vendor: rate.vendor,
          },
          allRates: [],
        });
      }
      zonesMap.get(key).allRates.push({
        weight: rate.weight,
        price: rate.price,
        vendor: rate.vendor,
      });
    });

    const zones = Array.from(zonesMap.values());

    // Find the best overall rate from filtered rates (lowest price)
    const bestOverallRate = filteredRates.reduce((best, current) => {
      return current.price < best.price ? current : best;
    });

    // Find the corresponding zone info for best overall rate
    const bestZoneInfo = zones.find(
      (zone) =>
        zone.zone === bestOverallRate.zone &&
        zone.service === bestOverallRate.service
    );

    return NextResponse.json({
      success: true,
      zones: zones.map((zone) => ({
        zone: zone.zone,
        country: zone.country,
        service: zone.service,
        bestRate: zone.bestRate,
      })),
      bestOverallRate: {
        zone: bestOverallRate.zone,
        country: bestZoneInfo?.country || "Unknown",
        service: bestOverallRate.service,
        bestRate: {
          weight: bestOverallRate.weight,
          price: bestOverallRate.price,
          vendor: bestOverallRate.vendor,
        },
      },
      allRates: filteredRates.map((rate) => ({
        zone: rate.zone,
        weight: rate.weight,
        price: rate.price,
        vendor: rate.vendor,
        service: rate.service,
      })),
    });
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
