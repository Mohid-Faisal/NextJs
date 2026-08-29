import { prisma } from "../src/lib/prisma";

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  
  for (const org of orgs) {
    const orgId = org.id;
    console.log(`\n=== Checking Payments in Org ${orgId} (${org.name}) ===`);

    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId: orgId }
    });

    const arAccount = accounts.find(a => a.accountName === "Accounts Receivable" || a.code === "1030");
    const apAccount = accounts.find(a => a.accountName === "Accounts Payable" || a.code === "2010");
    const revAccount = accounts.find(a => a.accountName === "Logistics Services Revenue" || a.code === "5101");
    const expAccount = accounts.find(a => a.accountName === "Vendor Expense" || a.code === "4101");

    // Check payment journal entry lines that have account = revAccount
    const custPaymentLinesOnRev = await prisma.journalEntryLine.findMany({
      where: {
        organizationId: orgId,
        accountId: revAccount?.id,
        reference: { startsWith: "Payment-" }
      },
      include: {
        journalEntry: true
      }
    });

    console.log(`Payment lines incorrectly credited to Revenue: ${custPaymentLinesOnRev.length}`);

    // Check payment journal entry lines that have account = expAccount and are vendor payments
    const vendPaymentLinesOnExp = await prisma.journalEntryLine.findMany({
      where: {
        organizationId: orgId,
        accountId: expAccount?.id,
        reference: { startsWith: "Payment-" }
      },
      include: {
        journalEntry: true
      }
    });

    console.log(`Payment lines incorrectly debited to Vendor Expense: ${vendPaymentLinesOnExp.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
