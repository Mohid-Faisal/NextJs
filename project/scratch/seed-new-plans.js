const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const targetPlans = [
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
        trialDays: 14,
        gracePeriodDays: 7,
        isActive: true,
        annualPrice: 24000,
        description: "Starter Plan: 100 shipments/mo, 1 user, 1 branch limit.",
        featuresList: ["100 shipments/month", "1 user limit", "1 branch limit", "All core features", "Excludes Remote Area & Finances"],
        currency: "USD",
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
        trialDays: 14,
        gracePeriodDays: 7,
        isActive: true,
        annualPrice: 36000,
        description: "Growth Plan: 300 shipments/mo, 5 users, 3 branches limit.",
        featuresList: ["300 shipments/month", "5 users limit", "3 branches limit", "Remote Area Lookup included", "Excludes Finances"],
        currency: "USD",
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
        currency: "USD",
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

  // Deactivate/delete other plans not in our list
  const allPlans = await prisma.plan.findMany();
  const allowedCodes = targetPlans.map(tp => tp.code);
  for (const p of allPlans) {
    if (!allowedCodes.includes(p.code)) {
      try {
        await prisma.plan.delete({
          where: { id: p.id }
        });
        console.log(`Deleted old plan: ${p.code}`);
      } catch (err) {
        // If referenced by subscription, deactivate it instead
        await prisma.plan.update({
          where: { id: p.id },
          data: {
            features: {
              ...(p.features || {}),
              isActive: false
            }
          }
        });
        console.log(`Deactivated old plan (has active subscriptions): ${p.code}`);
      }
    }
  }

  console.log("Seeding complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
