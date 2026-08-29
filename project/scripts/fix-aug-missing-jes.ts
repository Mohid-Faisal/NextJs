import { prisma } from "../src/lib/prisma";
import { nextJournalEntryNumber } from "../src/lib/sequences";

async function main() {
  const orgId = 1;

  const accounts = await prisma.chartOfAccount.findMany({ where: { organizationId: orgId } });
  const arAccount = accounts.find(a => a.accountName === "Accounts Receivable" || a.code === "1030");
  const apAccount = accounts.find(a => a.accountName === "Accounts Payable" || a.code === "2010");
  const revAccount = accounts.find(a => a.accountName === "Logistics Services Revenue" || a.code === "5101");
  const expAccount = accounts.find(a => a.accountName === "Vendor Expense" || a.code === "4101");

  // 1. Invoice 618915
  const inv = await prisma.invoice.findFirst({
    where: { organizationId: orgId, invoiceNumber: "618915" },
    include: { shipment: true }
  });

  if (inv) {
    const existing = await prisma.journalEntry.findFirst({
      where: { organizationId: orgId, reference: "618915" }
    });
    if (!existing) {
      const entryNumber = await nextJournalEntryNumber(prisma, orgId);
      const entryDate = inv.shipment?.shipmentDate || inv.createdAt;
      const amount = Number(inv.totalAmount);
      await prisma.journalEntry.create({
        data: {
          organizationId: orgId,
          entryNumber,
          date: entryDate,
          description: `Customer invoice for shipment ${inv.shipment?.trackingId || inv.trackingNumber}`,
          reference: "618915",
          totalDebit: amount,
          totalCredit: amount,
          isPosted: true,
          postedAt: entryDate,
          lines: {
            create: [
              {
                organizationId: orgId,
                accountId: arAccount!.id,
                debitAmount: amount,
                creditAmount: 0,
                description: `Debit: Customer owes money`,
                reference: "618915"
              },
              {
                organizationId: orgId,
                accountId: revAccount!.id,
                debitAmount: 0,
                creditAmount: amount,
                description: `Credit: Revenue earned`,
                reference: "618915"
              }
            ]
          }
        }
      });
      console.log(`Created JE ${entryNumber} for Customer Invoice 618915 (PKR ${amount})`);
    } else {
      console.log(`JE for 618915 already exists: ${existing.entryNumber}`);
    }
  }

  // 2. Vendor Bill 618917
  const bill = await prisma.invoice.findFirst({
    where: { organizationId: orgId, invoiceNumber: "618917" },
    include: { shipment: true }
  });

  if (bill) {
    const existing = await prisma.journalEntry.findFirst({
      where: { organizationId: orgId, reference: "618917" }
    });
    if (!existing) {
      const entryNumber = await nextJournalEntryNumber(prisma, orgId);
      const entryDate = bill.shipment?.shipmentDate || bill.createdAt;
      const amount = Number(bill.totalAmount);
      await prisma.journalEntry.create({
        data: {
          organizationId: orgId,
          entryNumber,
          date: entryDate,
          description: `Vendor invoice for shipment ${bill.shipment?.trackingId || bill.trackingNumber}`,
          reference: "618917",
          totalDebit: amount,
          totalCredit: amount,
          isPosted: true,
          postedAt: entryDate,
          lines: {
            create: [
              {
                organizationId: orgId,
                accountId: expAccount!.id,
                debitAmount: amount,
                creditAmount: 0,
                description: `Debit: Expense incurred`,
                reference: "618917"
              },
              {
                organizationId: orgId,
                accountId: apAccount!.id,
                debitAmount: 0,
                creditAmount: amount,
                description: `Credit: Accounts payable increased`,
                reference: "618917"
              }
            ]
          }
        }
      });
      console.log(`Created JE ${entryNumber} for Vendor Bill 618917 (PKR ${amount})`);
    } else {
      console.log(`JE for 618917 already exists: ${existing.entryNumber}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
