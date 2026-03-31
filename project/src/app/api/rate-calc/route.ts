import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { origin, destination, originZip, destinationZip, weight, docType, height, width, length, profitPercentage } =
      body;

    const debugTag = "[RATE-CALC]";
    const log = (step: string, payload?: unknown) =>
      console.log(`${debugTag} ${step}`, payload ?? "");

    log("request", { destination, weight, docType, height, width, length, profitPercentage });

    if (!origin || !destination || !weight || !docType) {
      return NextResponse.json(
        { error: "Origin, destination, weight, and document type are required." },
        { status: 400 }
      );
    }

    const profitPercent = profitPercentage || 0;
    const profitMultiplier = 1 + profitPercent / 100;

    const volume = (height * width * length) / 5000;
    let weightNumber: number;
    if (volume > weight) {
      weightNumber = Math.ceil(volume);
    } else {
      weightNumber = parseFloat(weight);
    }

    if (isNaN(weightNumber) || weightNumber <= 0) {
      return NextResponse.json(
        { error: "Weight must be a valid positive number." },
        { status: 400 }
      );
    }

    log("weight", { actual: Number(weight), volumetric: volume, billed: weightNumber });

    // ── Step 1: Fixed charge ──────────────────────────────────────────────
    const fixedCharge = await prisma.fixedCharge.findFirst({
      where: { weight: weightNumber },
      orderBy: { weight: "asc" },
    });

    // ── Step 2: Find zones for destination country ────────────────────────
    const zoneRows = await prisma.zone.findMany({
      where: {
        country: { contains: destination, mode: "insensitive" },
      },
      select: { zone: true, country: true, service: true },
    });

    log("zones.raw", { count: zoneRows.length, sample: zoneRows.slice(0, 15) });

    if (zoneRows.length === 0) {
      return NextResponse.json(
        { error: `No zones found for destination: ${destination}` },
        { status: 404 }
      );
    }

    // Normalize zone strings: "Zone 7A" -> "7A", "Zone 5" -> "5"
    const normalizedZones = zoneRows.map((z) => {
      const raw = z.zone;
      let zoneKey: string;
      if (typeof raw === "string") {
        const m = raw.match(/Zone\s*(\d+[A-Za-z]?)/i);
        zoneKey = m ? m[1] : raw.replace(/^Zone\s*/i, "").trim() || raw;
      } else {
        zoneKey = String(raw);
      }
      return { zoneKey, service: z.service.toLowerCase(), country: z.country };
    });

    log("zones.normalized", normalizedZones.slice(0, 20));

    // ── Step 3: Get vendor-service pairs ──────────────────────────────────
    const vendorServices = await prisma.vendorservice.findMany();
    const vsMap = new Map<string, string>();
    vendorServices.forEach((vs) => {
      vsMap.set(vs.service.toLowerCase(), vs.vendor);
    });

    log("vendorServices", vendorServices.map((vs) => `${vs.vendor} → ${vs.service}`));

    // ── Step 4: For each zone+service, find the rate ─────────────────────
    // Build a map of what services actually exist in Rate table per vendor
    const rateServiceSample = await prisma.rate.findMany({
      where: { docType },
      distinct: ["vendor", "service"],
      select: { vendor: true, service: true },
    });
    const rateServicesByVendor = new Map<string, string[]>();
    for (const r of rateServiceSample) {
      const key = r.vendor.toLowerCase();
      if (!rateServicesByVendor.has(key)) rateServicesByVendor.set(key, []);
      rateServicesByVendor.get(key)!.push(r.service);
    }
    log("rate.services.inDB", Object.fromEntries(rateServicesByVendor));

    type MatchedRate = {
      zoneKey: string;
      country: string;
      zoneService: string;
      vendor: string;
      rateService: string;
      weight: number;
      price: number;
    };

    const matchedRates: MatchedRate[] = [];

    for (const z of normalizedZones) {
      const vendor = vsMap.get(z.service);
      if (!vendor) {
        log("zone.skip.no-vendor", { zoneKey: z.zoneKey, zoneService: z.service });
        continue;
      }

      const vendorRateServices = rateServicesByVendor.get(vendor.toLowerCase()) || [];
      const serviceMatchesInRates = vendorRateServices.filter(
        (s) => s.toLowerCase() === z.service.toLowerCase()
      );

      if (serviceMatchesInRates.length === 0) {
        log("zone.skip.service-mismatch", {
          zoneKey: z.zoneKey,
          vendor,
          zoneService: z.service,
          rateServicesForVendor: vendorRateServices,
          hint: "Zone service name doesn't match any Rate service name for this vendor",
        });
        continue;
      }

      const rate = await prisma.rate.findFirst({
        where: {
          zone: z.zoneKey,
          vendor: vendor,
          service: { equals: z.service, mode: "insensitive" },
          docType: docType,
          weight: { gte: weightNumber },
        },
        orderBy: { weight: "asc" },
      });

      if (!rate) {
        const maxWeightRow = await prisma.rate.findFirst({
          where: {
            vendor: vendor,
            service: { equals: z.service, mode: "insensitive" },
            zone: z.zoneKey,
            docType: docType,
          },
          orderBy: { weight: "desc" },
          select: { weight: true, zone: true },
        });
        log("zone.skip.no-rate", {
          zoneKey: z.zoneKey,
          vendor,
          service: z.service,
          docType,
          billedWeight: weightNumber,
          maxWeightInRates: maxWeightRow?.weight ?? "no rows at all",
          hint: maxWeightRow
            ? `Billed weight ${weightNumber} exceeds max rate weight ${maxWeightRow.weight}`
            : "No rate rows exist for this zone+vendor+service+docType combo",
        });
        continue;
      }

      log("zone.matched", {
        zoneKey: z.zoneKey,
        vendor,
        service: z.service,
        rateWeight: rate.weight,
        ratePrice: rate.price,
      });

      matchedRates.push({
        zoneKey: z.zoneKey,
        country: z.country,
        zoneService: z.service,
        vendor: rate.vendor,
        rateService: rate.service,
        weight: rate.weight,
        price: rate.price,
      });
    }

    log("matched.total", matchedRates.length);

    if (matchedRates.length === 0) {
      return NextResponse.json(
        {
          error: `No rates found for destination: ${destination}, document type: ${docType}, and weight: ${weightNumber}kg`,
        },
        { status: 404 }
      );
    }

    // ── Step 5: Build response ────────────────────────────────────────────
    const fc = fixedCharge?.fixedCharge ?? 0;

    const buildPrice = (basePrice: number) => ({
      price: Math.round((basePrice + fc) * profitMultiplier),
      originalPrice: basePrice + fc,
    });

    // Sort by price ascending
    matchedRates.sort((a, b) => a.price - b.price);

    const allRates = matchedRates.map((r) => {
      const { price, originalPrice } = buildPrice(r.price);
      return {
        zone: r.zoneKey,
        weight: r.weight,
        price,
        vendor: r.vendor,
        service: r.zoneService,
        originalPrice,
      };
    });

    const zones = matchedRates.map((r) => {
      const { price, originalPrice } = buildPrice(r.price);
      return {
        zone: r.zoneKey,
        country: r.country,
        service: r.zoneService,
        bestRate: { weight: r.weight, price, vendor: r.vendor, originalPrice },
      };
    });

    const top3 = allRates.slice(0, 3).map((r, i) => ({
      rank: i + 1,
      zone: r.zone,
      country: matchedRates[i]?.country || "Unknown",
      service: r.service,
      bestRate: {
        weight: r.weight,
        price: r.price,
        vendor: r.vendor,
        originalPrice: r.originalPrice,
      },
    }));

    const best = top3[0];

    const responsePayload = {
      success: true,
      profitPercentage: profitPercent,
      fixedCharge: fixedCharge
        ? { weight: fixedCharge.weight, amount: fixedCharge.fixedCharge }
        : null,
      zones,
      top3Rates: top3,
      bestOverallRate: {
        zone: best.zone,
        country: best.country,
        service: best.service,
        bestRate: best.bestRate,
      },
      allRates,
    };

    log("response", {
      zonesCount: zones.length,
      top3Count: top3.length,
      bestService: best.service,
      bestPrice: best.bestRate.price,
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("❌ Error calculating rate:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
