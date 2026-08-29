import { prisma } from "../src/lib/prisma";

async function main() {
  const orgId = 1;
  const dateFrom = "2026-08-01";
  const dateTo = "2026-08-31";

  const whereClause: any = {
    organizationId: orgId,
    date: {
      gte: new Date(dateFrom + 'T00:00:00.000Z'),
      lte: new Date(dateTo + 'T23:59:59.999Z')
    }
  };

  const journalEntries = await prisma.journalEntry.findMany({
    where: whereClause,
    include: {
      lines: {
        include: {
          account: true
        }
      }
    },
    orderBy: {
      date: 'desc',
    },
  });

  console.log(`Checking which lines have account 4101:`);
  let expSum = 0;
  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      if (line.account.code === "4101" || line.account.accountName === "Vendor Expense") {
        const amt = Number(line.debitAmount) - Number(line.creditAmount);
        expSum += amt;
        console.log(`JE #${entry.entryNumber} (ID ${entry.id}, Line ID ${line.id}): Ref="${line.reference || entry.reference}", Desc="${line.description || entry.description}", Debit=${line.debitAmount}, Credit=${line.creditAmount}, Date=${entry.date.toISOString()}`);
      }
    }
  }
  console.log(`\nTotal 4101 sum: ${expSum}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
