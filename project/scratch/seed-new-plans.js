const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const targetPlans = [
    {
      code: "trial",
      name: "14-Day Free Trial",
      priceMonthlyUsd: 0,
      maxUsers: 0,
      maxShipmentsPerMonth: 0,
      features: {
        map: true,
        accounts: true,
        bulkUpload: true,
        analytics: true,
        activityLogs: true,
        customersPage: true,
        vendorsPage: true,
        recipientsPage: true,
        maxBranches: 0,
        trialDays: 14,
        gracePeriodDays: 7,
        isActive: true,
        annualPrice: 0,
        description: "14-day free trial gives full access to our site for testing and getting the feel of it.",
        featuresList: ["14 Days Free Trial", "Full access to all features", "No payment info required upfront"],
        currency: "PKR",
        sortOrder: -1
      }
    },
    {
      code: "starter",
      name: "Starter",
      priceMonthlyUsd: 2000,
      maxUsers: 1,
      maxShipmentsPerMonth: 100,
      features: {
        map: false,
        accounts: false,
        bulkUpload: true,
        analytics: true,
        activityLogs: true,
        customersPage: true,
        vendorsPage: true,
        recipientsPage: true,
        maxBranches: 1,
        trialDays: 0,
        gracePeriodDays: 7,
        isActive: true,
        annualPrice: 24000,
        description: "Starter Plan: 100 shipments/mo, 1 user, 1 branch limit.",
        featuresList: ["100 shipments/month", "1 user limit", "1 branch limit", "All core features", "Excludes Remote Area & Finances"],
        currency: "PKR",
        sortOrder: 0
      }
    },
    {
      code: "growth",
      name: "Growth",
      priceMonthlyUsd: 3000,
      maxUsers: 5,
      maxShipmentsPerMonth: 300,
      features: {
        map: true,
        accounts: false,
        bulkUpload: true,
        analytics: true,
        activityLogs: true,
        customersPage: true,
        vendorsPage: true,
        recipientsPage: true,
        maxBranches: 3,
        trialDays: 0,
        gracePeriodDays: 7,
        isActive: true,
        annualPrice: 36000,
        description: "Growth Plan: 300 shipments/mo, 5 users, 3 branches limit.",
        featuresList: ["300 shipments/month", "5 users limit", "3 branches limit", "Remote Area Lookup included", "Excludes Finances"],
        currency: "PKR",
        sortOrder: 1
      }
    },
    {
      code: "pro",
      name: "Pro",
      priceMonthlyUsd: 5000,
      maxUsers: 10,
      maxShipmentsPerMonth: 500,
      features: {
        map: true,
        accounts: true,
        bulkUpload: true,
        analytics: true,
        activityLogs: true,
        customersPage: true,
        vendorsPage: true,
        recipientsPage: true,
        maxBranches: 5,
        trialDays: 14,
        gracePeriodDays: 7,
        isActive: true,
        annualPrice: 60000,
        description: "Pro Plan: 500 shipments/mo, 10 users, 5 branches limit.",
        featuresList: ["500 shipments/month", "10 users limit", "5 branches limit", "Remote Area Lookup included", "Finances & Reports included", "All features enabled"],
        currency: "PKR",
        sortOrder: 2
      }
    }
  ];

  console.log("Seeding plans...");
  for (const p of targetPlans) {
    const existing = await prisma.plan.findUnique({
      where: { code: p.code }
    });
    if (existing) {
      await prisma.plan.update({
        where: { code: p.code },
        data: {
          name: p.name,
          priceMonthlyUsd: p.priceMonthlyUsd,
          maxUsers: p.maxUsers,
          maxShipmentsPerMonth: p.maxShipmentsPerMonth,
          features: p.features
        }
      });
      console.log(`Updated plan: ${p.code}`);
    } else {
      await prisma.plan.create({
        data: p
      });
      console.log(`Created plan: ${p.code}`);
    }
  }

  console.log("Seeding complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
