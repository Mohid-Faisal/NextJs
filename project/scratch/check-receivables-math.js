const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const currentYear = 2026;
  const currentMonth = 6; // July

  const curMonthStart = new Date(currentYear, currentMonth, 1);
  const curMonthEnd = new Date(currentYear, currentMonth + 1, 1);

  console.log("Range Start:", curMonthStart.toISOString());
  console.log("Range End Exclusive:", curMonthEnd.toISOString());

  const monthInvoices = await prisma.invoice.findMany({
    where: {
      organizationId: 1,
      customerId: { not: null },
      status: { not: "Cancelled" },
      createdAt: {
        gte: curMonthStart,
        lt: curMonthEnd,
      },
    },
    select: {
      invoiceNumber: true,
      totalAmount: true,
      status: true,
      createdAt: true
    },
  });

  console.log("\nInvoices found in this range:");
  console.log(JSON.stringify(monthInvoices, null, 2));

  const gross = monthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  console.log("\nGross Total:", gross);

  const invoiceNumbers = monthInvoices.map((i) => i.invoiceNumber);
  if (invoiceNumbers.length === 0) {
    console.log("No invoices found.");
    return;
  }

  const paymentsReceived = await prisma.payment.findMany({
    where: {
      organizationId: 1,
      transactionType: "INCOME",
      fromCustomerId: { not: null },
      date: {
        gte: curMonthStart,
        lt: curMonthEnd,
      },
      invoice: { in: invoiceNumbers },
    }
  });

  console.log("\nPayments found in this range:");
  console.log(JSON.stringify(paymentsReceived, null, 2));

  const paid = paymentsReceived.reduce((sum, p) => sum + p.amount, 0);
  console.log("\nPaid Total:", paid);

  const net = gross - paid;
  console.log("\nNet calculated:", net);
}

main().catch(console.error).finally(() => prisma.$disconnect());
