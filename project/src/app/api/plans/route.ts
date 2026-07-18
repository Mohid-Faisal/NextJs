import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";
import { getCurrencyForCountry, fetchExchangeRates } from "@/lib/currency";

/**
 * GET /api/plans
 * Public — used by the org signup page to render plan choices.
 */
export async function GET(req: NextRequest) {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { priceMonthlyUsd: "asc" },
      include: {
        _count: {
          select: { subscriptions: true }
        }
      }
    });

    const countryHeader = req.headers.get("x-vercel-ip-country") || "PK";
    const isPakistan = countryHeader.toUpperCase().trim() === "PK";
    const targetCurrency = isPakistan ? "PKR" : getCurrencyForCountry(countryHeader);
    
    const rates = await fetchExchangeRates();
    const rate = rates[targetCurrency] || 1;
    const pkrRate = rates["PKR"] || 278.0;
    
    // Base prices in database are in PKR.
    // If user is outside Pakistan, convert to local currency and add 10% markup.
    const pkrToLocalRate = isPakistan ? 1.0 : (rate / pkrRate) * 1.10;

    const convertedPlans = plans.map(plan => {
      let featuresObj = plan.features as any;
      if (typeof featuresObj === "string") {
        try {
          featuresObj = JSON.parse(featuresObj);
        } catch {
          featuresObj = {};
        }
      }

      const discountPercent = featuresObj.yearlyDiscountPercent !== undefined 
        ? parseFloat(featuresObj.yearlyDiscountPercent) 
        : 20;

      const localPriceMonthly = plan.priceMonthlyUsd * pkrToLocalRate;
      const localPriceAnnual = localPriceMonthly * 12 * (1 - (discountPercent / 100));

      if (featuresObj.annualPrice !== undefined) {
        featuresObj.annualPrice = parseFloat(featuresObj.annualPrice) * pkrToLocalRate;
      }

      // Override features object to include currency, so front-end picks it up
      const updatedFeatures = {
        ...featuresObj,
        currency: targetCurrency,
      };

      return {
        ...plan,
        priceMonthlyUsd: localPriceMonthly, // Override so frontend uses this as price
        features: updatedFeatures,
        localCurrency: targetCurrency,
        localPriceMonthly,
        localPriceAnnual,
        yearlyDiscountPercent: discountPercent
      };
    });

    return NextResponse.json({ success: true, plans: convertedPlans });
  } catch (error) {
    console.error("Error listing plans:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list plans" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plans
 * Super-admin only. Creates a new subscription plan.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { code, name, priceMonthlyUsd, maxUsers, maxShipmentsPerMonth, features } = body;

    if (!code?.trim() || !name?.trim() || priceMonthlyUsd === undefined || maxUsers === undefined || maxShipmentsPerMonth === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: code, name, priceMonthlyUsd, maxUsers, maxShipmentsPerMonth" },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toLowerCase();
    const existing = await prisma.plan.findUnique({
      where: { code: cleanCode }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A plan with code "${cleanCode}" already exists.` },
        { status: 409 }
      );
    }

    const plan = await prisma.plan.create({
      data: {
        code: cleanCode,
        name: name.trim(),
        priceMonthlyUsd: parseFloat(priceMonthlyUsd),
        maxUsers: parseInt(maxUsers, 10),
        maxShipmentsPerMonth: parseInt(maxShipmentsPerMonth, 10),
        features: features || {},
      }
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("Error creating plan:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create plan" },
      { status: 500 }
    );
  }
}

