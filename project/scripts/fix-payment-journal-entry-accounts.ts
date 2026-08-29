import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`Starting Payment Journal Entry Account Correction. Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });

  for (const org of orgs) {
    const orgId = org.id;
    console.log(`\n======================================================`);
    console.log(`Processing Org ${orgId}: ${org.name}`);
    console.log(`======================================================`);

    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId: orgId }
    });

    const arAccount = accounts.find(a => a.accountName === "Accounts Receivable" || a.code === "1030");
    const apAccount = accounts.find(a => a.accountName === "Accounts Payable" || a.code === "2010");
    const revAccount = accounts.find(a => a.accountName === "Logistics Services Revenue" || a.code === "5101");
    const expAccount = accounts.find(a => a.accountName === "Vendor Expense" || a.code === "4101");

    if (!arAccount || !apAccount) {
      console.error(`Org ${orgId} is missing Accounts Receivable (${arAccount?.id}) or Accounts Payable (${apAccount?.id})`);
      continue;
    }

    // 1. Find all journal entry lines for customer payments that are currently pointing to a Revenue account instead of Accounts Receivable
    const custLinesToFix = await prisma.journalEntryLine.findMany({
      where: {
        organizationId: orgId,
        reference: { startsWith: "Payment-" },
        creditAmount: { gt: 0 },
        account: {
          category: "Revenue"
        }
      },
      include: {
        journalEntry: true,
        account: true
      }
    });

    console.log(`Found ${custLinesToFix.length} customer payment credit lines pointing to Revenue accounts.`);

    // 2. Find all journal entry lines for vendor payments that are currently pointing to Vendor Expense instead of Accounts Payable
    // Note: We only want to redirect Vendor payments (not other operating expenses like Fuel, Equipment, etc.)
    const vendLinesToFix = await prisma.journalEntryLine.findMany({
      where: {
        organizationId: orgId,
        reference: { startsWith: "Payment-" },
        debitAmount: { gt: 0 },
        account: {
          accountName: "Vendor Expense"
        }
      },
      include: {
        journalEntry: true,
        account: true
      }
    });

    console.log(`Found ${vendLinesToFix.length} vendor payment debit lines pointing to Vendor Expense.`);

    if (APPLY) {
      // Fix customer payment lines -> Accounts Receivable
      if (custLinesToFix.length > 0) {
        const lineIds = custLinesToFix.map(l => l.id);
        const result = await prisma.journalEntryLine.updateMany({
          where: { id: { in: lineIds } },
          data: {
            accountId: arAccount.id,
            description: "Credit: Accounts Receivable reduced"
          }
        });
        console.log(`[APPLIED] Updated ${result.count} customer payment lines to Accounts Receivable (${arAccount.code} - ${arAccount.accountName})`);
      }

      // Fix vendor payment lines -> Accounts Payable
      if (vendLinesToFix.length > 0) {
        const lineIds = vendLinesToFix.map(l => l.id);
        const result = await prisma.journalEntryLine.updateMany({
          where: { id: { in: lineIds } },
          data: {
            accountId: apAccount.id,
            description: "Debit: Accounts Payable reduced"
          }
        });
        console.log(`[APPLIED] Updated ${result.count} vendor payment lines to Accounts Payable (${apAccount.code} - ${apAccount.accountName})`);
      }
    }
  }

  console.log("\nDone!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
