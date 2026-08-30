import { prisma } from "../src/lib/prisma";

async function main() {
  const customerId = 2530;

  const customer = await prisma.customers.findUnique({
    where: { id: customerId }
  });

  const listTransactions = await prisma.customerTransaction.findMany({
    where: { customerId }
  });

  const invoiceNumbersList = listTransactions
    .filter((t) => t.invoice)
    .map((t) => t.invoice!)
    .filter((inv, index, self) => self.indexOf(inv) === index);

  const invoicesList = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: invoiceNumbersList } },
    include: {
      shipment: { select: { shipmentDate: true } },
    },
  });

  const invoicesMapList = new Map();
  invoicesList.forEach((inv) => {
    invoicesMapList.set(inv.invoiceNumber, {
      shipmentDate: inv.shipment?.shipmentDate || undefined,
      invoiceDate: inv.invoiceDate,
    });
  });

  const transactionsWithVoucherDatesList = listTransactions.map((transaction) => {
    let voucherDate = transaction.createdAt;
    if (transaction.invoice && transaction.type === "DEBIT") {
      const invoiceData = invoicesMapList.get(transaction.invoice);
      if (invoiceData?.shipmentDate) voucherDate = invoiceData.shipmentDate;
      else if (invoiceData?.invoiceDate) voucherDate = invoiceData.invoiceDate;
    }
    return {
      ...transaction,
      voucherDate,
    };
  });

  const chronologicalAll = [...transactionsWithVoucherDatesList].sort((a, b) => {
    const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    if (a.type === "DEBIT" && b.type === "CREDIT") return -1;
    if (a.type === "CREDIT" && b.type === "DEBIT") return 1;
    const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    if (a.invoice && b.invoice) {
      const invA = parseInt(a.invoice, 10);
      const invB = parseInt(b.invoice, 10);
      if (!Number.isNaN(invA) && !Number.isNaN(invB)) {
        return invA - invB;
      }
      return a.invoice.localeCompare(b.invoice);
    }
    return 0;
  });

  const startingBalanceTransaction = chronologicalAll.find(
    (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
  );

  let runningBal = 0;
  if (startingBalanceTransaction) {
    runningBal = startingBalanceTransaction.type === 'DEBIT' 
      ? -Number(startingBalanceTransaction.amount || 0) 
      : Number(startingBalanceTransaction.amount || 0);
  }

  const balanceByTxId = new Map();
  if (startingBalanceTransaction) {
    balanceByTxId.set(startingBalanceTransaction.id, {
      previousBalance: 0,
      newBalance: runningBal
    });
  }

  for (const t of chronologicalAll) {
    if (t.reference && t.reference.startsWith("STARTING-BALANCE")) continue;
    const prev = runningBal;
    const next = t.type === 'CREDIT' ? prev + Number(t.amount || 0) : prev - Number(t.amount || 0);
    runningBal = next;
    balanceByTxId.set(t.id, {
      previousBalance: prev,
      newBalance: next
    });
  }

  console.log(`Final calculated running balance: ${runningBal}`);

  // Display the top 5 transactions sorted for display (date desc)
  const displayList = [...chronologicalAll]
    .map(t => {
      const b = balanceByTxId.get(t.id);
      return {
        ...t,
        previousBalance: b.previousBalance,
        newBalance: b.newBalance
      };
    })
    .sort((a, b) => {
      const dateDiff = b.voucherDate.getTime() - a.voucherDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.type === "DEBIT" && b.type === "CREDIT") return 1;
      if (a.type === "CREDIT" && b.type === "DEBIT") return -1;
      return 0;
    });

  console.log("\n=== TOP 6 ROWS IN UI TABLE ===");
  for (const t of displayList.slice(0, 6)) {
    console.log(`Invoice: ${t.invoice} | Date: ${t.voucherDate.toISOString().slice(0, 16)} | Debit: ${t.type === 'DEBIT' ? t.amount : '-'} | Credit: ${t.type === 'CREDIT' ? t.amount : '-'} | Balance: ${t.newBalance}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
