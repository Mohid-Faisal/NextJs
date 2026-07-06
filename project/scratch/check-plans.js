const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const plans = await prisma.plan.findMany();
  console.log("=== PLANS ===");
  console.log(JSON.stringify(plans, null, 2));

  const orgs = await prisma.organization.findMany({
    include: {
      subscription: {
        include: {
          plan: true
        }
      }
    }
  });
  console.log("=== ORGS ===");
  console.log(JSON.stringify(orgs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
