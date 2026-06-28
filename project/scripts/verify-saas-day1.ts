const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const orgs = await prisma.organization.findMany({
      include: { subscription: { include: { plan: true } }, members: true },
    });
    const plans = await prisma.plan.findMany({ orderBy: { priceMonthlyUsd: "asc" } });
    console.log("Organizations:", JSON.stringify(orgs, null, 2));
    console.log("Plans:", plans.map((p) => `${p.code} ($${p.priceMonthlyUsd}/mo)`).join(", "));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
