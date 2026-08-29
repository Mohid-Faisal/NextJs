import { prisma } from "../src/lib/prisma";

async function main() {
  const orgId = 1;
  const augStart = new Date("2026-08-01T00:00:00.000Z");
  const augEnd = new Date("2026-09-01T00:00:00.000Z");

  const accounts = await prisma.chartOfAccount.findMany({ where: { organizationId: orgId } });
  const expAccount = accounts.find(a => a.accountName === "Vendor Expense" || a.code === "4101");

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
    },
    orderBy: { journalEntry: { date: "asc" } }
  });

  console.log(`Total 4101 Expense Lines in August 2026: ${expLines.length}`);
  let total = 0;
  for (const line of expLines) {
    const amt = Number(line.debitAmount);
    total += amt;
    console.log(`JE #${line.journalEntry.entryNumber} (JE ID ${line.journalEntry.id}, Line ID ${line.id}): Ref="${line.reference}", Desc="${line.journalEntry.description}", Amt=${amt}, Date=${line.journalEntry.date.toISOString()}`);
  }
  console.log(`\nTotal Vendor Expense sum in August: ${total}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
