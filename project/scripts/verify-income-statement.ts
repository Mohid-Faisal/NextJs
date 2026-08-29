import { prisma } from "../src/lib/prisma";

async function main() {
  const orgId = 1;
  const augStart = new Date("2026-08-01T00:00:00.000Z");
  const augEnd = new Date("2026-09-01T00:00:00.000Z");

  const accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId: orgId },
    include: {
      journalLines: {
        where: {
          organizationId: orgId,
          journalEntry: {
            date: { gte: augStart, lt: augEnd }
          }
        },
        include: { journalEntry: true }
      }
    }
  });

  const revenues = accounts.filter(a => a.category === "Revenue");
  const expenses = accounts.filter(a => a.category === "Expense");

  console.log("=== INCOME STATEMENT CALCULATION (AUGUST 2026) ===");
  console.log("\n--- REVENUES ---");
  let totalRev = 0;
  for (const acc of revenues) {
    const bal = acc.journalLines.reduce((s, l) => s + Number(l.creditAmount) - Number(l.debitAmount), 0);
    console.log(`${acc.code} ${acc.accountName}: PKR ${bal.toLocaleString()} (Lines: ${acc.journalLines.length})`);
    totalRev += bal;
  }
  console.log(`TOTAL REVENUES: PKR ${totalRev.toLocaleString()}`);

  console.log("\n--- EXPENSES ---");
  let totalExp = 0;
  for (const acc of expenses) {
    const bal = acc.journalLines.reduce((s, l) => s + Number(l.debitAmount) - Number(l.creditAmount), 0);
    console.log(`${acc.code} ${acc.accountName}: PKR ${bal.toLocaleString()} (Lines: ${acc.journalLines.length})`);
    totalExp += bal;
  }
  console.log(`TOTAL EXPENSES: PKR ${totalExp.toLocaleString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
