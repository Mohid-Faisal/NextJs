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

  console.log(`Total Journal Entries matched in August: ${journalEntries.length}`);

  const transformedEntries = journalEntries.flatMap(entry => 
    entry.lines.map(line => ({
      id: `${entry.id}-${line.id}`,
      date: entry.date,
      description: line.description || entry.description,
      amount: line.debitAmount > 0 ? line.debitAmount : line.creditAmount,
      reference: line.reference || entry.reference,
      transactionType: line.debitAmount > 0 ? 'DEBIT' : 'CREDIT',
      category: line.account.category,
      accountName: line.account.accountName,
      accountCode: line.account.code,
      accountId: line.account.id,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount
    }))
  );

  console.log(`Total lines: ${transformedEntries.length}`);

  const accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId: orgId }
  });

  const balanceMap = new Map();
  accounts.forEach(account => {
    if (account.category === 'Revenue' || account.category === 'Expense') {
      balanceMap.set(account.id, {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.accountName,
        category: account.category,
        balance: 0,
        debitAmount: 0,
        creditAmount: 0
      });
    }
  });

  transformedEntries.forEach(entry => {
    const account = accounts.find(acc => acc.id === entry.accountId);
    if (!account || (account.category !== 'Revenue' && account.category !== 'Expense')) return;

    const currentBalance = balanceMap.get(account.id);
    if (!currentBalance) return;

    const debitAmount = Number(entry.debitAmount) || 0;
    const creditAmount = Number(entry.creditAmount) || 0;

    let newBalance = currentBalance.balance;
    if (account.category === 'Revenue') {
      newBalance += creditAmount - debitAmount;
    } else if (account.category === 'Expense') {
      newBalance += debitAmount - creditAmount;
    }

    balanceMap.set(account.id, {
      ...currentBalance,
      balance: newBalance,
      debitAmount: currentBalance.debitAmount + debitAmount,
      creditAmount: currentBalance.creditAmount + creditAmount
    });
  });

  console.log("\n=== BALANCES FROM ACCOUNT-BOOKS ===");
  for (const b of balanceMap.values()) {
    if (b.balance > 0 || b.debitAmount > 0 || b.creditAmount > 0) {
      console.log(`${b.accountCode} ${b.accountName}: Balance=${b.balance} (Debit=${b.debitAmount}, Credit=${b.creditAmount})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
