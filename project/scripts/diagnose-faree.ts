/**
 * Diagnostic: compare a customer's invoices (shipments) and payments against
 * the CustomerTransaction ledger to find missing entries.
 * Run: npx tsx scripts/diagnose-faree.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const customers = await prisma.customers.findMany({
    where: {
      OR: [
        { CompanyName: { contains: "Faree"} },
        { PersonName: { contains: "Farina"} },
        { PersonName: { contains: "Ghani"} },
      ],
    },
    select: { id: true, CompanyName: true, PersonName: true, currentBalance: true },
  });

  console.log("=== MATCHING CUSTOMERS ===");
  console.log(JSON.stringify(customers, null, 2));
  if (customers.length === 0) return;

  for (const cust of customers) {
    const customerId = cust.id;
    console.log("\n\n################################################");
    console.log(`CUSTOMER ${customerId}: ${cust.CompanyName} / ${cust.PersonName}`);
    console.log(`Stored currentBalance: ${cust.currentBalance}`);
    console.log("################################################");

    const invoices = await prisma.invoice.findMany({
      where: { customerId },
      select: {
        invoiceNumber: true,
        profile: true,
        status: true,
        totalAmount: true,
        invoiceDate: true,
        shipmentId: true,
        trackingNumber: true,
      },
      orderBy: { invoiceNumber: "asc" },
    });

    const payments = await prisma.payment.findMany({
      where: { fromCustomerId: customerId, transactionType: "INCOME" },
      select: { id: true, amount: true, date: true, reference: true, invoice: true, description: true },
      orderBy: { date: "asc" },
    });

    const txns = await prisma.customerTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: "asc" },
    });

    console.log(`\n--- INVOICES (customer-side): ${invoices.length} ---`);
    for (const inv of invoices) {
      console.log(
        `inv#${inv.invoiceNumber} profile=${inv.profile} status=${inv.status} amount=${inv.totalAmount} shipmentId=${inv.shipmentId} tracking=${inv.trackingNumber} date=${inv.invoiceDate?.toISOString?.().slice(0,10)}`
      );
    }

    console.log(`\n--- PAYMENTS (INCOME from customer): ${payments.length} ---`);
    for (const p of payments) {
      console.log(
        `pay#${p.id} amount=${p.amount} ref=${p.reference} invoice=${p.invoice} date=${p.date?.toISOString?.().slice(0,10)} desc=${p.description}`
      );
    }

    console.log(`\n--- CUSTOMER TRANSACTIONS: ${txns.length} ---`);
    let dr = 0, cr = 0;
    for (const t of txns) {
      if (t.type === "DEBIT") dr += t.amount; else cr += t.amount;
      console.log(
        `txn#${t.id} ${t.type} amount=${t.amount} ref=${t.reference} invoice=${t.invoice} bal=${t.newBalance} created=${t.createdAt.toISOString().slice(0,10)} | ${t.description?.slice(0,60)}`
      );
    }
    console.log(`\nSum DEBIT=${dr} Sum CREDIT=${cr} net(CR-DR)=${cr - dr}`);

    // Cross-check: invoices that should have a DEBIT txn
    const txnInvoiceSet = new Set(txns.filter(t => t.invoice).map(t => t.invoice));
    const debitTxnInvoiceSet = new Set(txns.filter(t => t.type === "DEBIT" && t.invoice).map(t => t.invoice));
    console.log(`\n=== MISSING DEBIT TRANSACTIONS (invoice exists, no DEBIT txn) ===`);
    let missingDebit = 0;
    for (const inv of invoices) {
      if (inv.status === "Cancelled") continue;
      if (!debitTxnInvoiceSet.has(inv.invoiceNumber)) {
        console.log(`  MISSING DEBIT for invoice ${inv.invoiceNumber} (status=${inv.status}, amount=${inv.totalAmount}, profile=${inv.profile})`);
        missingDebit++;
      }
    }
    if (missingDebit === 0) console.log("  none");

    // Cross-check: payments that should have a CREDIT txn
    console.log(`\n=== MISSING CREDIT TRANSACTIONS (payment exists, no matching CREDIT txn) ===`);
    const creditTxns = txns.filter(t => t.type === "CREDIT");
    let missingCredit = 0;
    for (const p of payments) {
      const match = creditTxns.find(t =>
        (p.reference && t.reference === p.reference) ||
        (p.invoice && t.invoice === p.invoice && Math.abs(t.amount - p.amount) < 0.01)
      );
      if (!match) {
        console.log(`  MISSING CREDIT for payment#${p.id} amount=${p.amount} ref=${p.reference} invoice=${p.invoice} date=${p.date?.toISOString?.().slice(0,10)}`);
        missingCredit++;
      }
    }
    if (missingCredit === 0) console.log("  none");

    console.log(`\nSUMMARY for ${cust.CompanyName}: invoices=${invoices.length}, payments=${payments.length}, txns=${txns.length}, missingDebit=${missingDebit}, missingCredit=${missingCredit}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => process.exit(0));
