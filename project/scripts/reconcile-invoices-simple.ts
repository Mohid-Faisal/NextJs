import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`=== SIMPLE SEQUENTIAL INVOICE RECONCILIATION (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });

  for (const org of orgs) {
    const orgId = org.id;
    console.log(`\n==============================================`);
    console.log(`Processing Org ${orgId}: ${org.name}`);
    console.log(`==============================================`);

    // 1. Fetch Chart of Accounts for Org
    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId: orgId }
    });

    const arAccount = accounts.find(a => a.accountName === "Accounts Receivable" || a.code === "1030");
    const apAccount = accounts.find(a => a.accountName === "Accounts Payable" || a.code === "2010");
    const revAccount = accounts.find(a => a.accountName === "Logistics Services Revenue" || a.code === "5101");
    const expAccount = accounts.find(a => a.accountName === "Vendor Expense" || a.code === "4101");

    if (!arAccount || !apAccount || !revAccount || !expAccount) {
      console.error("Missing required accounts for org:", { arAccount, apAccount, revAccount, expAccount });
      continue;
    }

    // 2. Fetch all Journal Entries and get max sequence number
    const allJEs = await prisma.journalEntry.findMany({
      where: { organizationId: orgId },
      select: { id: true, reference: true, totalDebit: true, entryNumber: true },
      orderBy: { id: "asc" }
    });

    let maxSeq = 1;
    for (const je of allJEs) {
      const m = /\d+/.exec(je.entryNumber);
      if (m) {
        const n = parseInt(m[0], 10);
        if (n >= maxSeq) maxSeq = n + 1;
      }
    }
    let seq = maxSeq;
    console.log(`Total existing JEs: ${allJEs.length}, Next JE Sequence: ${seq}`);

    // Map existing JEs by reference
    const jeByRef = new Map<string, (typeof allJEs)[0]>();
    for (const je of allJEs) {
      if (je.reference && !je.reference.startsWith("Transaction-")) {
        jeByRef.set(je.reference, je);
      }
    }

    // 3. Fetch all active invoices with totalAmount > 0
    const allInvoices = await prisma.invoice.findMany({
      where: { 
        organizationId: orgId, 
        status: { not: "Cancelled" },
        totalAmount: { gt: 0 }
      },
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

    console.log(`Total active invoices with amount > 0: ${allInvoices.length}`);

    const missingInvoices = allInvoices.filter(inv => !jeByRef.has(inv.invoiceNumber));
    console.log(`Missing Journal Entries: ${missingInvoices.length}`);

    if (APPLY && missingInvoices.length > 0) {
      console.log(`Creating ${missingInvoices.length} missing journal entries sequentially...`);
      let count = 0;

      for (const inv of missingInvoices) {
        const currentSeq = seq++;
        const entryNumber = `JE-${String(currentSeq).padStart(4, "0")}`;
        const invAmount = Number(inv.totalAmount || 0);
        const isCustomer = inv.profile === "Customer" || (inv.customerId && !inv.vendorId);
        const entryDate = inv.shipment?.shipmentDate || inv.invoiceDate || inv.createdAt;
        const tracking = inv.shipment?.trackingId || inv.trackingNumber || inv.invoiceNumber;
        const desc = isCustomer 
          ? `Customer invoice for shipment ${tracking}`
          : `Vendor invoice for shipment ${tracking}`;

        await prisma.journalEntry.create({
          data: {
            organizationId: orgId,
            entryNumber,
            date: entryDate,
            description: desc,
            reference: inv.invoiceNumber,
            totalDebit: invAmount,
            totalCredit: invAmount,
            isPosted: true,
            postedAt: entryDate,
            lines: {
              create: isCustomer
                ? [
                    {
                      organizationId: orgId,
                      accountId: arAccount.id,
                      debitAmount: invAmount,
                      creditAmount: 0,
                      description: `Debit: Customer owes money`,
                      reference: inv.invoiceNumber
                    },
                    {
                      organizationId: orgId,
                      accountId: revAccount.id,
                      debitAmount: 0,
                      creditAmount: invAmount,
                      description: `Credit: Revenue earned`,
                      reference: inv.invoiceNumber
                    }
                  ]
                : [
                    {
                      organizationId: orgId,
                      accountId: expAccount.id,
                      debitAmount: invAmount,
                      creditAmount: 0,
                      description: `Debit: Expense incurred`,
                      reference: inv.invoiceNumber
                    },
                    {
                      organizationId: orgId,
                      accountId: apAccount.id,
                      debitAmount: 0,
                      creditAmount: invAmount,
                      description: `Credit: Accounts payable increased`,
                      reference: inv.invoiceNumber
                    }
                  ]
            }
          }
        });

        count++;
        if (count % 250 === 0 || count >= missingInvoices.length) {
          console.log(`Created ${count} / ${missingInvoices.length} JEs`);
        }
      }

      console.log(`[APPLIED] Successfully created all ${missingInvoices.length} missing journal entries.`);
    }
  }

  console.log("\nReconciliation complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
