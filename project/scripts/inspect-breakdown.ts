import { prisma } from "../src/lib/prisma";

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const org of orgs) {
    const orgId = org.id;
    console.log(`\n=== Checking Org ${orgId} (${org.name}) ===`);

    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId: orgId },
      select: { id: true, code: true, accountName: true, category: true }
    });

    const arAccount = accounts.find(a => a.accountName === "Accounts Receivable" || a.code === "1030");
    const apAccount = accounts.find(a => a.accountName === "Accounts Payable" || a.code === "2010");
    const revAccount = accounts.find(a => a.accountName === "Logistics Services Revenue" || a.code === "5101");
    const expAccount = accounts.find(a => a.accountName === "Vendor Expense" || a.code === "4101");

    console.log({
      ar: arAccount?.id,
      ap: apAccount?.id,
      rev: revAccount?.id,
      exp: expAccount?.id
    });

    const augStart = new Date("2026-08-01T00:00:00.000Z");
    const augEnd = new Date("2026-09-01T00:00:00.000Z");

    const revLines = await prisma.journalEntryLine.findMany({
      where: {
        organizationId: orgId,
        accountId: revAccount?.id,
        journalEntry: {
          date: { gte: augStart, lt: augEnd }
        }
      },
      include: {
        journalEntry: true
      }
    });

    const fromInvoices = revLines.filter(l => !l.reference?.startsWith("Payment-"));
    const fromPayments = revLines.filter(l => l.reference?.startsWith("Payment-"));
    console.log(`August Revenue total: ${revLines.reduce((s, l) => s + Number(l.creditAmount), 0)}`);
    console.log(`  From Invoices: count=${fromInvoices.length}, sum=${fromInvoices.reduce((s, l) => s + Number(l.creditAmount), 0)}`);
    console.log(`  From Payments: count=${fromPayments.length}, sum=${fromPayments.reduce((s, l) => s + Number(l.creditAmount), 0)}`);

    const expLines = await prisma.journalEntryLine.findMany({
      where: {
        organizationId: orgId,
        accountId: expAccount?.id,
        journalEntry: {
          date: { gte: augStart, lt: augEnd }
        }
      },
      include: {
        journalEntry: true
      }
    });

    const expFromInvoices = expLines.filter(l => !l.reference?.startsWith("Payment-"));
    const expFromPayments = expLines.filter(l => l.reference?.startsWith("Payment-"));
    console.log(`August Vendor Expense total: ${expLines.reduce((s, l) => s + Number(l.debitAmount), 0)}`);
    console.log(`  From Invoices/Bills: count=${expFromInvoices.length}, sum=${expFromInvoices.reduce((s, l) => s + Number(l.debitAmount), 0)}`);
    console.log(`  From Payments: count=${expFromPayments.length}, sum=${expFromPayments.reduce((s, l) => s + Number(l.debitAmount), 0)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
