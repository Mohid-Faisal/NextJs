import { prisma } from "../src/lib/prisma";
import { createJournalEntryForTransaction } from "../src/lib/server/ledger";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`=== INVOICE & JOURNAL ENTRY RECONCILIATION (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });

  for (const org of orgs) {
    const orgId = org.id;
    console.log(`\n==============================================`);
    console.log(`Processing Org ${orgId}: ${org.name}`);
    console.log(`==============================================`);

    // 1. Fetch only essential fields of Journal Entries
    console.log("Fetching journal entries metadata...");
    const allJEs = await prisma.journalEntry.findMany({
      where: { organizationId: orgId },
      select: { id: true, reference: true, totalDebit: true, entryNumber: true },
      orderBy: { id: "asc" }
    });
    console.log(`Fetched ${allJEs.length} journal entries.`);

    const jeByRef = new Map<string, typeof allJEs>();
    for (const je of allJEs) {
      if (je.reference && !je.reference.startsWith("Transaction-")) {
        const list = jeByRef.get(je.reference) || [];
        list.push(je);
        jeByRef.set(je.reference, list);
      }
    }

    const duplicatesToDelete: number[] = [];
    for (const [ref, list] of jeByRef.entries()) {
      if (list.length > 1) {
        const keep = list[list.length - 1];
        const dupes = list.slice(0, list.length - 1);
        console.log(`Found ${dupes.length} duplicate JE(s) for reference "${ref}". Keeping #${keep.entryNumber} (ID ${keep.id}), deleting IDs: ${dupes.map(d => d.id).join(", ")}`);
        for (const d of dupes) {
          duplicatesToDelete.push(d.id);
        }
        jeByRef.set(ref, [keep]);
      }
    }

    console.log(`Total duplicate journal entries found: ${duplicatesToDelete.length}`);

    if (APPLY && duplicatesToDelete.length > 0) {
      // Delete in chunks of 500
      for (let i = 0; i < duplicatesToDelete.length; i += 500) {
        const chunk = duplicatesToDelete.slice(i, i + 500);
        await prisma.journalEntryLine.deleteMany({
          where: { journalEntryId: { in: chunk } }
        });
        await prisma.journalEntry.deleteMany({
          where: { id: { in: chunk } }
        });
      }
      console.log(`[APPLIED] Deleted ${duplicatesToDelete.length} duplicate journal entries.`);
    }

    // 2. Fetch all active invoices
    console.log("Fetching active invoices...");
    const allInvoices = await prisma.invoice.findMany({
      where: { organizationId: orgId, status: { not: "Cancelled" } },
      select: {
        id: true,
        invoiceNumber: true,
        profile: true,
        customerId: true,
        vendorId: true,
        totalAmount: true,
        trackingNumber: true,
        invoiceDate: true,
        createdAt: true,
        shipment: {
          select: {
            trackingId: true,
            shipmentDate: true
          }
        }
      }
    });

    console.log(`Total active invoices in org: ${allInvoices.length}`);

    const missingInvoices: typeof allInvoices = [];
    const mismatchedInvoices: { inv: (typeof allInvoices)[0]; je: (typeof allJEs)[0] }[] = [];

    for (const inv of allInvoices) {
      const invAmount = Number(inv.totalAmount || 0);
      if (invAmount <= 0) continue; // 0-amount invoices don't have revenue/expense

      const list = jeByRef.get(inv.invoiceNumber);
      const existingJE = list && list.length > 0 ? list[0] : undefined;

      if (!existingJE) {
        missingInvoices.push(inv);
      } else {
        const jeAmount = Number(existingJE.totalDebit || 0);
        if (Math.abs(jeAmount - invAmount) > 0.01) {
          mismatchedInvoices.push({ inv, je: existingJE });
        }
      }
    }

    console.log(`Found ${missingInvoices.length} invoices with missing Journal Entries.`);
    console.log(`Found ${mismatchedInvoices.length} invoices with mismatched Journal Entry amounts.`);

    if (missingInvoices.length > 0) {
      console.log("\nSample missing invoices:");
      for (const inv of missingInvoices.slice(0, 10)) {
        console.log(`  - #${inv.invoiceNumber} (${inv.profile}): Amount = ${inv.totalAmount}, Date = ${inv.createdAt?.toISOString()}`);
      }
    }

    if (mismatchedInvoices.length > 0) {
      console.log("\nSample mismatched invoices:");
      for (const { inv, je } of mismatchedInvoices.slice(0, 10)) {
        console.log(`  - #${inv.invoiceNumber} (${inv.profile}): Invoice = ${inv.totalAmount}, JE #${je.entryNumber} = ${je.totalDebit}`);
      }
    }

    if (APPLY) {
      // Create missing JEs
      const BATCH_SIZE = 4;
      for (let i = 0; i < missingInvoices.length; i += BATCH_SIZE) {
        const batch = missingInvoices.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (inv) => {
          const invAmount = Number(inv.totalAmount || 0);
          const isCustomer = inv.profile === "Customer" || (inv.customerId && !inv.vendorId);
          const type = isCustomer ? "CUSTOMER_DEBIT" : "VENDOR_DEBIT";
          const entryDate = inv.shipment?.shipmentDate || inv.invoiceDate || inv.createdAt;
          const tracking = inv.shipment?.trackingId || inv.trackingNumber || inv.invoiceNumber;
          const desc = isCustomer 
            ? `Customer invoice for shipment ${tracking}`
            : `Vendor invoice for shipment ${tracking}`;

          await createJournalEntryForTransaction(
            prisma,
            type,
            invAmount,
            desc,
            inv.invoiceNumber,
            inv.invoiceNumber,
            entryDate,
            orgId
          );
        }));
      }
      console.log(`[APPLIED] Created ${missingInvoices.length} missing journal entries.`);

      // Update mismatched JEs
      for (const { inv, je } of mismatchedInvoices) {
        const invAmount = Number(inv.totalAmount || 0);
        await prisma.journalEntry.update({
          where: { id: je.id },
          data: {
            totalDebit: invAmount,
            totalCredit: invAmount,
            updatedAt: new Date()
          }
        });
        await prisma.journalEntryLine.updateMany({
          where: { journalEntryId: je.id, debitAmount: { gt: 0 } },
          data: { debitAmount: invAmount }
        });
        await prisma.journalEntryLine.updateMany({
          where: { journalEntryId: je.id, creditAmount: { gt: 0 } },
          data: { creditAmount: invAmount }
        });
      }
      console.log(`[APPLIED] Updated ${mismatchedInvoices.length} mismatched journal entries.`);
    }
  }

  console.log("\nReconciliation complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
