import { prisma } from "../src/lib/prisma";

async function main() {
  const orgId = 1;
  
  // Delete lines for 55557
  await prisma.journalEntryLine.deleteMany({
    where: { journalEntryId: 55557 }
  });
  
  // Delete JE 55557
  await prisma.journalEntry.delete({
    where: { id: 55557 }
  });

  console.log("Deleted duplicate JE ID 55557.");

  // Re-run account books check for August 2026
  const dateFrom = "2026-08-01";
  const dateTo = "2026-08-31";

  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      organizationId: orgId,
      date: {
        gte: new Date(dateFrom + 'T00:00:00.000Z'),
        lte: new Date(dateTo + 'T23:59:59.999Z')
      }
    },
    include: {
      lines: {
        include: { account: true }
      }
    }
  });

  let expSum = 0;
  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      if (line.account.code === "4101" || line.account.accountName === "Vendor Expense") {
        expSum += Number(line.debitAmount) - Number(line.creditAmount);
      }
    }
  }

  let revSum = 0;
  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      if (line.account.code === "5101" || line.account.accountName === "Logistics Services Revenue") {
        revSum += Number(line.creditAmount) - Number(line.debitAmount);
      }
    }
  }

  console.log(`\n=== FINAL RECONCILED AUGUST 2026 METRICS ===`);
  console.log(`5101 Logistics Services Revenue: PKR ${revSum.toLocaleString()}`);
  console.log(`4101 Vendor Expense:             PKR ${expSum.toLocaleString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
