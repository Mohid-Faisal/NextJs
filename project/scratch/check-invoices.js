const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Checking July 2026 Shipments...");
    const shipments = await prisma.shipment.findMany({
      where: {
        createdAt: {
          gte: new Date(2026, 6, 1), // July 1st, 2026 (0-indexed month)
          lt: new Date(2026, 7, 1)   // August 1st, 2026
        }
      },
      select: {
        id: true,
        trackingId: true,
        invoiceNumber: true,
        invoiceStatus: true,
        totalCost: true,
        createdAt: true
      }
    });
    console.log(`Found ${shipments.length} shipments:`);
    console.log(JSON.stringify(shipments, null, 2));

    console.log("\nChecking July 2026 Invoices...");
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: new Date(2026, 6, 1),
          lt: new Date(2026, 7, 1)
        }
      }
    });
    console.log(`Found ${invoices.length} invoices:`);
    console.log(JSON.stringify(invoices, null, 2));

  } catch (err) {
    console.error("FAILED:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
