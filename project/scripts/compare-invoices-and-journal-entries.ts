import { prisma } from "../src/lib/prisma";

async function main() {
  const orgId = 1;
  const augStart = new Date("2026-08-01T00:00:00.000Z");
  const augEnd = new Date("2026-09-01T00:00:00.000Z");

  console.log("=== COMPARING AUGUST 2026 INVOICES VS JOURNAL ENTRIES ===");

  // 1. All August Customer Invoices
  const custInvoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      profile: "Customer",
      createdAt: { gte: augStart, lt: augEnd }
    },
    select: {
      id: true,
      invoiceNumber: true,
      createdAt: true,
      invoiceDate: true,
      totalAmount: true,
      status: true,
      shipment: {
        select: {
          id: true,
          trackingId: true,
          shipmentDate: true
        }
      }
    }
  });

  const totalCustInvoices = custInvoices.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0);
  console.log(`Total Customer Invoices: ${custInvoices.length}, Total Amount: ${totalCustInvoices}`);

  // 2. All August Revenue Journal Entries
  const accounts = await prisma.chartOfAccount.findMany({ where: { organizationId: orgId } });
  const revAccount = accounts.find(a => a.accountName === "Logistics Services Revenue" || a.code === "5101");
  const expAccount = accounts.find(a => a.accountName === "Vendor Expense" || a.code === "4101");

  const revLines = await prisma.journalEntryLine.findMany({
    where: {
      organizationId: orgId,
      accountId: revAccount?.id,
      journalEntry: {
        date: { gte: augStart, lt: augEnd }
      }
    },
    include: {
      journalEntry: true
    }
  });

  const totalRevCredits = revLines.reduce((s, l) => s + Number(l.creditAmount), 0);
  console.log(`Total August Revenue JE Lines: ${revLines.length}, Total Credit: ${totalRevCredits}`);
  console.log(`Customer Invoices vs Revenue JE diff = ${totalCustInvoices - totalRevCredits}`);

  // Find which invoices have no JE or have different amount
  console.log("\n--- Checking Each Customer Invoice vs Revenue Journal Entries ---");
  for (const inv of custInvoices) {
    // Look for JE referencing this invoice or shipment
    const matchingLines = await prisma.journalEntryLine.findMany({
      where: {
        organizationId: orgId,
        accountId: revAccount?.id,
        OR: [
          { reference: inv.invoiceNumber },
          { reference: `Invoice-${inv.invoiceNumber}` },
          { reference: `INV-${inv.invoiceNumber}` },
          { journalEntry: { reference: inv.invoiceNumber } },
          { journalEntry: { reference: `Invoice-${inv.invoiceNumber}` } },
          { journalEntry: { reference: `INV-${inv.invoiceNumber}` } },
          { journalEntry: { description: { contains: inv.invoiceNumber } } }
        ]
      },
      include: { journalEntry: true }
    });

    const sumJe = matchingLines.reduce((s, l) => s + Number(l.creditAmount), 0);
    const invAmt = Number(inv.totalAmount || 0);

    if (matchingLines.length === 0) {
      console.log(`[NO JE FOUND] Invoice #${inv.invoiceNumber} (ID: ${inv.id}): Amount = ${invAmt}, Date = ${inv.createdAt?.toISOString()}`);
    } else if (Math.abs(sumJe - invAmt) > 0.01) {
      console.log(`[AMOUNT MISMATCH] Invoice #${inv.invoiceNumber}: Invoice Amount = ${invAmt}, JE Sum = ${sumJe}`);
    } else {
      // Check JE date
      const jeDate = matchingLines[0].journalEntry.date;
      if (jeDate < augStart || jeDate >= augEnd) {
        console.log(`[DATE OUTSIDE AUG] Invoice #${inv.invoiceNumber}: Invoice Date = ${inv.createdAt?.toISOString()}, JE Date = ${jeDate.toISOString()}`);
      }
    }
  }

  // 3. All August Vendor Bills
  console.log("\n=== COMPARING AUGUST 2026 VENDOR BILLS VS VENDOR EXPENSE JE ===");
  const vendBills = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      profile: "Vendor",
      createdAt: { gte: augStart, lt: augEnd }
    },
    select: {
      id: true,
      invoiceNumber: true,
      createdAt: true,
      invoiceDate: true,
      totalAmount: true,
      status: true
    }
  });

  const totalVendBills = vendBills.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0);
  console.log(`Total Vendor Bills: ${vendBills.length}, Total Amount: ${totalVendBills}`);

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
    }
  });

  const totalExpDebits = expLines.reduce((s, l) => s + Number(l.debitAmount), 0);
  console.log(`Total August Vendor Expense JE Lines: ${expLines.length}, Total Debit: ${totalExpDebits}`);
  console.log(`Vendor Bills vs Vendor Expense JE diff = ${totalVendBills - totalExpDebits}`);

  console.log("\n--- Checking Each Vendor Bill vs Expense Journal Entries ---");
  for (const bill of vendBills) {
    const matchingLines = await prisma.journalEntryLine.findMany({
      where: {
        organizationId: orgId,
        accountId: expAccount?.id,
        OR: [
          { reference: bill.invoiceNumber },
          { reference: `Invoice-${bill.invoiceNumber}` },
          { reference: `BILL-${bill.invoiceNumber}` },
          { journalEntry: { reference: bill.invoiceNumber } },
          { journalEntry: { description: { contains: bill.invoiceNumber } } }
        ]
      },
      include: { journalEntry: true }
    });

    const sumJe = matchingLines.reduce((s, l) => s + Number(l.debitAmount), 0);
    const billAmt = Number(bill.totalAmount || 0);

    if (matchingLines.length === 0) {
      console.log(`[NO JE FOUND] Vendor Bill #${bill.invoiceNumber} (ID: ${bill.id}): Amount = ${billAmt}, Date = ${bill.createdAt?.toISOString()}`);
    } else if (Math.abs(sumJe - billAmt) > 0.01) {
      console.log(`[AMOUNT MISMATCH] Vendor Bill #${bill.invoiceNumber}: Bill Amount = ${billAmt}, JE Sum = ${sumJe}`);
    } else {
      const jeDate = matchingLines[0].journalEntry.date;
      if (jeDate < augStart || jeDate >= augEnd) {
        console.log(`[DATE OUTSIDE AUG] Vendor Bill #${bill.invoiceNumber}: Bill Date = ${bill.createdAt?.toISOString()}, JE Date = ${jeDate.toISOString()}`);
      }
    }
  }

  // Also check if there are JE in August that don't belong to August invoices
  console.log("\n--- Checking JE in August that might not match August Invoices ---");
  for (const line of revLines) {
    console.log(`Rev JE #${line.journalEntry.entryNumber}: Ref = ${line.reference || line.journalEntry.reference}, Desc = ${line.journalEntry.description}, Amt = ${line.creditAmount}, Date = ${line.journalEntry.date.toISOString()}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
