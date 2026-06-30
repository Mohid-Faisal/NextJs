const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Testing domestic query...");
    const count = await prisma.shipment.count({
      where: {
        OR: [
          { destination: { equals: "PK", mode: "insensitive" } },
          { destination: { equals: "Pakistan", mode: "insensitive" } }
        ]
      }
    });
    console.log("Success! Count is:", count);
  } catch (error) {
    console.error("Prisma query failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
