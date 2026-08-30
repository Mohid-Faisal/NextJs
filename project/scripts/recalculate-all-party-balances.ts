import { prisma } from "../src/lib/prisma";
import { debitVoucherDateFromInvoice } from "../src/lib/accounts/invoiceDebitVoucherDate";
import { isCustomerCreditNoteReference, isVendorDebitNoteReference } from "../src/lib/noteFormats";

async function main() {
  console.log("=== RECALCULATING ALL CUSTOMER & VENDOR TRANSACTIONS & BALANCES IN DB ===\n");

  // 1. Recalculate Customers
  const customers = await prisma.customers.findMany({
    select: { id: true, CompanyName: true, organizationId: true }
  });

  console.log(`Processing ${customers.length} customers...`);

  for (const customer of customers) {
    const listTransactions = await prisma.customerTransaction.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "asc" }
    });

    if (listTransactions.length === 0) continue;

    const creditNoteRefsList = listTransactions
      .filter((t) => isCustomerCreditNoteReference(t.reference))
      .map((t) => t.reference!)
      .filter((ref, index, self) => self.indexOf(ref) === index);

    const creditNotesMapList = new Map<string, Date>();
    if (creditNoteRefsList.length > 0) {
      const creditNotesList = await prisma.creditNote.findMany({
        where: { creditNoteNumber: { in: creditNoteRefsList } },
        select: { creditNoteNumber: true, date: true }
      });
      creditNotesList.forEach((cn) => {
        if (cn.date) creditNotesMapList.set(cn.creditNoteNumber, cn.date);
      });
    }

    const invoiceNumbersList = listTransactions
      .filter((t) => t.invoice)
      .map((t) => t.invoice!)
      .filter((inv, index, self) => self.indexOf(inv) === index);

    const invoicesMapList = new Map<string, { shipmentDate?: Date; invoiceDate?: Date }>();
    if (invoiceNumbersList.length > 0) {
      const invoicesList = await prisma.invoice.findMany({
        where: { invoiceNumber: { in: invoiceNumbersList } },
        include: { shipment: { select: { shipmentDate: true } } }
      });
      invoicesList.forEach((inv) => {
        invoicesMapList.set(inv.invoiceNumber, {
          shipmentDate: inv.shipment?.shipmentDate || undefined,
          invoiceDate: inv.invoiceDate
        });
      });
    }

    const transactionsWithDates = listTransactions.map((t) => {
      let voucherDate = t.createdAt;
      if (t.reference && creditNotesMapList.has(t.reference)) {
        voucherDate = creditNotesMapList.get(t.reference)!;
      } else if (t.invoice && t.type === "DEBIT") {
        const invData = invoicesMapList.get(t.invoice);
        const vd = debitVoucherDateFromInvoice(invData);
        if (vd) voucherDate = vd;
      }
      return { ...t, voucherDate };
    });

    // Sort chronologically
    transactionsWithDates.sort((a, b) => {
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

    const startingBalanceTransaction = transactionsWithDates.find(
      (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
    );

    let runningBal = 0;
    if (startingBalanceTransaction) {
      runningBal = startingBalanceTransaction.type === 'DEBIT' 
        ? -Number(startingBalanceTransaction.amount || 0)
        : Number(startingBalanceTransaction.amount || 0);
    }

    for (const t of transactionsWithDates) {
      if (t.reference && t.reference.startsWith("STARTING-BALANCE")) {
        await prisma.customerTransaction.update({
          where: { id: t.id },
          data: { previousBalance: 0, newBalance: runningBal }
        });
        continue;
      }
      const prev = runningBal;
      const next = t.type === 'CREDIT' ? prev + Number(t.amount || 0) : prev - Number(t.amount || 0);
      runningBal = next;
      await prisma.customerTransaction.update({
        where: { id: t.id },
        data: { previousBalance: prev, newBalance: next }
      });
    }

    await prisma.customers.update({
      where: { id: customer.id },
      data: { currentBalance: runningBal }
    });
  }

  console.log("Customer transactions & balances updated successfully.\n");

  // 2. Recalculate Vendors
  const vendors = await prisma.vendors.findMany({
    select: { id: true, CompanyName: true, organizationId: true }
  });

  console.log(`Processing ${vendors.length} vendors...`);

  for (const vendor of vendors) {
    const listTransactions = await prisma.vendorTransaction.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "asc" }
    });

    if (listTransactions.length === 0) continue;

    const debitNoteRefsList = listTransactions
      .filter((t) => isVendorDebitNoteReference(t.reference))
      .map((t) => t.reference!)
      .filter((ref, index, self) => self.indexOf(ref) === index);

    const debitNotesMapList = new Map<string, Date>();
    if (debitNoteRefsList.length > 0) {
      const debitNotesList = await prisma.debitNote.findMany({
        where: { debitNoteNumber: { in: debitNoteRefsList } },
        select: { debitNoteNumber: true, date: true }
      });
      debitNotesList.forEach((dn) => {
        if (dn.date) debitNotesMapList.set(dn.debitNoteNumber, dn.date);
      });
    }

    const invoiceNumbersList = listTransactions
      .filter((t) => t.invoice)
      .map((t) => t.invoice!)
      .filter((inv, index, self) => self.indexOf(inv) === index);

    const invoicesMapList = new Map<string, { shipmentDate?: Date; invoiceDate?: Date }>();
    if (invoiceNumbersList.length > 0) {
      const invoicesList = await prisma.invoice.findMany({
        where: { invoiceNumber: { in: invoiceNumbersList } },
        include: { shipment: { select: { shipmentDate: true } } }
      });
      invoicesList.forEach((inv) => {
        invoicesMapList.set(inv.invoiceNumber, {
          shipmentDate: inv.shipment?.shipmentDate || undefined,
          invoiceDate: inv.invoiceDate
        });
      });
    }

    const transactionsWithDates = listTransactions.map((t) => {
      let voucherDate = t.createdAt;
      if (t.reference && debitNotesMapList.has(t.reference)) {
        voucherDate = debitNotesMapList.get(t.reference)!;
      } else if (t.invoice && t.type === "DEBIT") {
        const invData = invoicesMapList.get(t.invoice);
        const vd = debitVoucherDateFromInvoice(invData);
        if (vd) voucherDate = vd;
      }
      return { ...t, voucherDate };
    });

    // Sort chronologically
    transactionsWithDates.sort((a, b) => {
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

    const startingBalanceTransaction = transactionsWithDates.find(
      (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
    );

    let runningBal = 0;
    if (startingBalanceTransaction) {
      runningBal = startingBalanceTransaction.type === 'DEBIT' 
        ? Number(startingBalanceTransaction.amount || 0)
        : -Number(startingBalanceTransaction.amount || 0);
    }

    for (const t of transactionsWithDates) {
      if (t.reference && t.reference.startsWith("STARTING-BALANCE")) {
        await prisma.vendorTransaction.update({
          where: { id: t.id },
          data: { previousBalance: 0, newBalance: runningBal }
        });
        continue;
      }
      const prev = runningBal;
      const next = t.type === 'DEBIT' ? prev + Number(t.amount || 0) : prev - Number(t.amount || 0);
      runningBal = next;
      await prisma.vendorTransaction.update({
        where: { id: t.id },
        data: { previousBalance: prev, newBalance: next }
      });
    }

    await prisma.vendors.update({
      where: { id: vendor.id },
      data: { currentBalance: runningBal }
    });
  }

  console.log("Vendor transactions & balances updated successfully.\n");
  console.log("ALL BALANCES RECALCULATED AND SYNCHRONIZED IN DB!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
