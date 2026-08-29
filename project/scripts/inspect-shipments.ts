import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const shipments = await prisma.shipment.findMany({
    take: 5,
    orderBy: { id: "desc" },
    select: {
      id: true,
      trackingId: true,
      invoiceNumber: true,
      totalCost: true,
      price: true,
      subtotal: true,
      cos: true,
      invoices: {
        select: { id: true, profile: true, totalAmount: true }
      }
    }
  });
  console.log("Recent shipments:", JSON.stringify(shipments, null, 2));

  const sumTotalCost = await prisma.shipment.aggregate({
    _sum: { totalCost: true, price: true, subtotal: true, cos: true }
  });
  console.log("Shipment sums:", sumTotalCost);

  const sumInvoices = await prisma.invoice.aggregate({
    where: { profile: "Customer" },
    _sum: { totalAmount: true }
  });
  console.log("Customer Invoices sum:", sumInvoices);
}
main().finally(() => prisma.$disconnect());
