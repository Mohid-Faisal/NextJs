import { prisma } from "../src/lib/prisma";

async function main() {
  const customerId = 2530;

  const transactions = await prisma.customerTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "asc" }
  });

  console.log(`=== CUSTOMER 2530 TRANSACTIONS (${transactions.length}) ===`);
  for (const t of transactions) {
    console.log(`ID ${t.id} | Date: ${t.createdAt.toISOString()} | Type: ${t.type} | Amount: ${t.amount} | Inv: ${t.invoice} | Ref: ${t.reference} | Stored Balance: ${t.balance}`);
  }

  const customer = await prisma.customers.findUnique({
    where: { id: customerId }
  });
  console.log(`\nCustomer currentBalance in DB: ${customer?.currentBalance}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
