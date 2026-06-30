import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const PLANS = [
  {
    code: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    maxUsers: 2,
    maxShipmentsPerMonth: 50,
    features: { accounts: false, bulkUpload: false, isActive: true, trialDays: 0, gracePeriodDays: 0, annualPrice: 0, description: "Get started at no cost. Up to 50 shipments/month." },
  },
  {
    code: "starter",
    name: "Starter",
    priceMonthlyUsd: 29,
    maxUsers: 5,
    maxShipmentsPerMonth: 500,
    features: { accounts: false, bulkUpload: true, isActive: true, trialDays: 14, gracePeriodDays: 7, annualPrice: 278.4, description: "Perfect for small businesses starting out." },
  },
  {
    code: "growth",
    name: "Growth",
    priceMonthlyUsd: 79,
    maxUsers: 15,
    maxShipmentsPerMonth: 2000,
    features: { accounts: true, bulkUpload: true, isActive: true, trialDays: 14, gracePeriodDays: 7, annualPrice: 758.4, description: "For growing businesses with higher volume." },
  },
  {
    code: "pro",
    name: "Pro",
    priceMonthlyUsd: 199,
    maxUsers: 50,
    maxShipmentsPerMonth: 10000,
    features: { accounts: true, bulkUpload: true, isActive: true, trialDays: 14, gracePeriodDays: 7, annualPrice: 1910.4, description: "Advanced features for professional logistics teams." },
  },
  {
    code: "enterprise",
    name: "Enterprise",
    priceMonthlyUsd: 499,
    maxUsers: 9999,
    maxShipmentsPerMonth: 999999,
    features: { accounts: true, bulkUpload: true, isActive: true, trialDays: 14, gracePeriodDays: 14, annualPrice: 4790.4, description: "Unlimited scale for enterprise operations." },
  },
];

async function main() {
  console.log("Upserting new pricing plans...");
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: plan,
      update: {
        name: plan.name,
        priceMonthlyUsd: plan.priceMonthlyUsd,
        maxUsers: plan.maxUsers,
        maxShipmentsPerMonth: plan.maxShipmentsPerMonth,
        features: plan.features,
      },
    });
  }
  console.log("Plans successfully seeded!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
