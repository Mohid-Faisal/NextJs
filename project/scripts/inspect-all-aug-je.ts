import { prisma } from "../src/lib/prisma";

async function main() {
  const orgId = 1;
  const augStart = new Date("2026-08-01T00:00:00.000Z");
  const augEnd = new Date("2026-09-01T00:00:00.000Z");

  console.log("=== INSPECTING ALL EXPENSE & REVENUE JOURNAL ENTRIES IN AUGUST 2026 ===");

  const accounts = await prisma.chartOfAccount.findMany({ where: { organizationId: orgId } });
  const revAccount = accounts.find(a => a.accountName === "Logistics Services Revenue" || a.code === "5101");
  const expAccount = accounts.find(a => a.accountName === "Vendor Expense" || a.code === "4101");

  // Check all JE for account 4101
  const allExpLines = await prisma.journalEntryLine.findMany({
    where: {
      organizationId: orgId,
      accountId: expAccount?.id,
      journalEntry: {
        date: { gte: augStart, lt: augEnd }
      }
    },
    include: {
      journalEntry: true
    },
    orderBy: { journalEntry: { date: "asc" } }
  });

  console.log(`Total 4101 Expense Lines in Aug: ${allExpLines.length}`);
  for (const line of allExpLines) {
    console.log(`Exp JE #${line.journalEntry.entryNumber} (JE ID ${line.journalEntry.id}, Line ID ${line.id}): Ref="${line.reference}", Desc="${line.journalEntry.description}", Amt=${line.debitAmount}, Date=${line.journalEntry.date.toISOString()}`);
  }

  // Check all JE for account 5101
  const allRevLines = await prisma.journalEntryLine.findMany({
    where: {
      organizationId: orgId,
      accountId: revAccount?.id,
      journalEntry: {
        date: { gte: augStart, lt: augEnd }
      }
    },
    include: {
      journalEntry: true
    },
    orderBy: { journalEntry: { date: "asc" } }
  });

  console.log(`\nTotal 5101 Revenue Lines in Aug: ${allRevLines.length}`);
  for (const line of allRevLines) {
    console.log(`Rev JE #${line.journalEntry.entryNumber} (JE ID ${line.journalEntry.id}, Line ID ${line.id}): Ref="${line.reference}", Desc="${line.journalEntry.description}", Amt=${line.creditAmount}, Date=${line.journalEntry.date.toISOString()}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
