const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const currentYear = 2026;
  const currentMonth = 6; // July

  const curMonthStart = new Date(currentYear, currentMonth, 1);
  const curMonthEnd = new Date(currentYear, currentMonth + 1, 1);

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
    },
  });

  let totalNetReceivable = 0;
  console.log("Invoices and their calculated remaining balances:");

  for (const inv of monthInvoices) {
    let remaining = 0;
    if (inv.status === "Unpaid") {
      remaining = inv.totalAmount;
    } else if (inv.status === "Partial") {
      const totalPayments = await prisma.payment.aggregate({
        where: {
          invoice: inv.invoiceNumber
        },
        _sum: {
          amount: true
        }
      });
      const totalPaid = totalPayments._sum.amount || 0;
      remaining = Math.max(0, inv.totalAmount - totalPaid);
    } else {
      remaining = 0;
    }

    console.log(`- Invoice ${inv.invoiceNumber} (${inv.status}): total = ${inv.totalAmount}, remaining = ${remaining}`);
    totalNetReceivable += remaining;
  }

  console.log("\nTotal Net Receivable:", totalNetReceivable);
}

main().catch(console.error).finally(() => prisma.$disconnect());
