import { prisma } from "../src/lib/prisma";

async function main() {
  const customerId = 2530;

  const transactions = await prisma.customerTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 15
  });

  console.log(`=== CUSTOMER 2530 RECENT TRANSACTIONS ===`);
  for (const t of transactions) {
    console.log(`ID: ${t.id} | Date: ${t.createdAt.toISOString()} | Inv: ${t.invoice} | Type: ${t.type} | Amt: ${t.amount} | PrevBal: ${t.previousBalance} | NewBal: ${t.newBalance}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
