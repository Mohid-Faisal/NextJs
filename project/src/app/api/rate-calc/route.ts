import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

function normalizeZoneKey(raw: string): string {
  if (typeof raw !== "string") return String(raw);
  const m = raw.match(/Zone\s*(\d+[A-Za-z]?)/i);
  const stripped = m ? m[1] : raw.replace(/^Zone\s*/i, "").trim() || raw;
  return stripped.replace(/^0+(\d)/, "$1");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

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
      where: orgWhere(session, { weight: weightNumber }),
      orderBy: { weight: "asc" },
    });

    // ── Step 2: Find zones for destination country ────────────────────────
    const zoneRows = await prisma.zone.findMany({
      where: orgWhere(session, {
        country: { contains: destination, mode: "insensitive" },
      }),
      select: { zone: true, country: true, service: true },
    });

    log("zones.raw", { count: zoneRows.length, sample: zoneRows.slice(0, 15) });

    if (zoneRows.length === 0) {
      return NextResponse.json(
        { error: `No zones found for destination: ${destination}` },
        { status: 404 }
      );
    }

    const normalizedZones = zoneRows.map((z) => ({
      zoneKey: normalizeZoneKey(z.zone),
      service: z.service.toLowerCase(),
      country: z.country,
    }));

    log("zones.normalized", normalizedZones.slice(0, 20));

    // ── Step 3: Get vendor-service pairs (one service → many vendors) ─────
    const vendorServices = await prisma.vendorservice.findMany({
      where: orgWhere(session),
    });
    const vsMultiMap = new Map<string, string[]>();
    vendorServices.forEach((vs) => {
      const key = vs.service.toLowerCase();
      if (!vsMultiMap.has(key)) vsMultiMap.set(key, []);
      vsMultiMap.get(key)!.push(vs.vendor);
    });

    log("vendorServices", vendorServices.map((vs) => `${vs.vendor} → ${vs.service}`));

    // ── Step 4: Fetch all rates for this docType in one query ─────────────
    const allDbRates = await prisma.rate.findMany({
      where: orgWhere(session, {
        docType,
        weight: { gte: weightNumber },
      }),
      orderBy: { weight: "asc" },
    });

    log("rates.fetched", { docType, minWeight: weightNumber, totalRows: allDbRates.length });

    // Index rates by (service_lower, normalizedZone) → all matching rows
    // Multiple vendors can have rates for the same service+zone
    const rateIndex = new Map<string, (typeof allDbRates)[0][]>();
    for (const r of allDbRates) {
      const normZone = normalizeZoneKey(r.zone);
      const key = `${r.service.toLowerCase()}|${normZone}`;
      if (!rateIndex.has(key)) rateIndex.set(key, []);
      const bucket = rateIndex.get(key)!;
      // Only keep the cheapest per vendor (rates are ordered by weight asc)
      if (!bucket.some((b) => b.vendor.toLowerCase() === r.vendor.toLowerCase())) {
        bucket.push(r);
      }
    }

    log("rates.indexed", { uniqueKeys: rateIndex.size });

    // ── Step 5: Match zones → rates (via service + zone key) ──────────────
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
      const vendors = vsMultiMap.get(z.service);
      if (!vendors || vendors.length === 0) {
        log("zone.skip.no-vendor", { zoneKey: z.zoneKey, zoneService: z.service });
        continue;
      }

      const key = `${z.service}|${z.zoneKey}`;
      const rates = rateIndex.get(key);

      if (!rates || rates.length === 0) {
        log("zone.skip.no-rate", {
          zoneKey: z.zoneKey,
          service: z.service,
          vendors,
          lookupKey: key,
        });
        continue;
      }

      for (const rate of rates) {
        log("zone.matched", {
          zoneKey: z.zoneKey,
          vendor: rate.vendor,
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

    // ── Step 6: Build response ────────────────────────────────────────────
    const fc = fixedCharge?.fixedCharge ?? 0;

    const buildPrice = (basePrice: number) => ({
      price: Math.round((basePrice + fc) * profitMultiplier),
      originalPrice: basePrice + fc,
    });

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
