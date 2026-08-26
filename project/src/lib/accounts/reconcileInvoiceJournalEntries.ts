import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { defaultAccounts } from "@/lib/accounts/defaultAccounts";

/**
 * Reconciles General Ledger Journal Entries with active Invoices.
 *
 * Ensures that:
 * 1. Every non-cancelled customer invoice has a corresponding CUSTOMER_DEBIT
 *    Revenue journal entry (5101 Logistics Services Revenue).
 * 2. Every non-cancelled vendor invoice has a corresponding VENDOR_DEBIT
 *    Vendor Expense journal entry.
 * 3. Any journal entry whose amount or date drifted from the invoice is updated.
 * 4. Any journal entry for a cancelled invoice is cleaned up.
 *
 * This function is fully idempotent and safe to run on page load.
 */
export async function reconcileInvoiceJournalEntries(
  session: SessionPayload,
  dateFrom?: string | Date,
  dateTo?: string | Date
): Promise<{ created: number; updated: number; removed: number }> {
  try {
    const orgId = session.organizationId;
    if (!orgId) return { created: 0, updated: 0, removed: 0 };

    // Ensure default Chart of Accounts exist for this organization
    const accountCount = await prisma.chartOfAccount.count({
      where: { organizationId: orgId },
    });
    if (accountCount === 0) {
      await prisma.chartOfAccount.createMany({
        data: defaultAccounts.map((acc) => ({
          ...acc,
          organizationId: orgId,
          isActive: true,
        })),
      });
    }

    const arAccount = await prisma.chartOfAccount.findFirst({
      where: { organizationId: orgId, accountName: "Accounts Receivable" },
    });
    const apAccount = await prisma.chartOfAccount.findFirst({
      where: { organizationId: orgId, accountName: "Accounts Payable" },
    });
    const revenueAccount = await prisma.chartOfAccount.findFirst({
      where: {
        organizationId: orgId,
        category: "Revenue",
        accountName: "Logistics Services Revenue",
      },
    });
    const expenseAccount = await prisma.chartOfAccount.findFirst({
      where: {
        organizationId: orgId,
        category: "Expense",
        accountName: "Vendor Expense",
      },
    });

    if (!arAccount || !revenueAccount || !apAccount || !expenseAccount) {
      console.warn("Reconcile invoices: missing essential chart of accounts for org", orgId);
      return { created: 0, updated: 0, removed: 0 };
    }

    // Build date filter for invoices if provided
    const invoiceWhere: any = {
      organizationId: orgId,
    };

    if (dateFrom || dateTo) {
      const fromD = dateFrom ? new Date(dateFrom) : undefined;
      const toD = dateTo ? new Date(dateTo) : undefined;

      const dateConditions: any[] = [];
      if (fromD && toD) {
        dateConditions.push(
          { invoiceDate: { gte: fromD, lte: toD } },
          { createdAt: { gte: fromD, lte: toD } },
          { shipment: { shipmentDate: { gte: fromD, lte: toD } } }
        );
      } else if (fromD) {
        dateConditions.push(
          { invoiceDate: { gte: fromD } },
          { createdAt: { gte: fromD } },
          { shipment: { shipmentDate: { gte: fromD } } }
        );
      } else if (toD) {
        dateConditions.push(
          { invoiceDate: { lte: toD } },
          { createdAt: { lte: toD } },
          { shipment: { shipmentDate: { lte: toD } } }
        );
      }
      if (dateConditions.length > 0) {
        invoiceWhere.OR = dateConditions;
      }
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        shipment: {
          select: {
            id: true,
            shipmentDate: true,
            trackingId: true,
          },
        },
      },
    });

    if (invoices.length === 0) {
      return { created: 0, updated: 0, removed: 0 };
    }

    const invoiceNumbers = invoices
      .map((i) => (i.invoiceNumber ?? "").trim())
      .filter((n) => n.length > 0);

    const existingJEs = await prisma.journalEntry.findMany({
      where: {
        organizationId: orgId,
        reference: { in: invoiceNumbers },
      },
      include: {
        lines: true,
      },
    });

    const jeByRef = new Map<string, (typeof existingJEs)[0]>();
    for (const je of existingJEs) {
      if (je.reference) {
        jeByRef.set(je.reference, je);
      }
    }

    // Determine next journal entry sequence counter
    let lastJe = await prisma.journalEntry.findFirst({
      where: { organizationId: orgId },
      orderBy: { entryNumber: "desc" },
      select: { entryNumber: true },
    });
    let seqCounter = 0;
    if (lastJe && lastJe.entryNumber) {
      const match = /(\d+)$/.exec(String(lastJe.entryNumber));
      if (match) {
        seqCounter = parseInt(match[1], 10) || 0;
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    let removedCount = 0;

    for (const inv of invoices) {
      const invNum = (inv.invoiceNumber ?? "").trim();
      if (!invNum) continue;

      const existingJE = jeByRef.get(invNum);
      const isCancelled = inv.status === "Cancelled";
      const amount = Number(inv.totalAmount) || 0;

      // 1. If invoice is cancelled and JE exists, remove the cancelled JE
      if (isCancelled) {
        if (existingJE) {
          await prisma.$transaction(async (tx) => {
            await tx.journalEntryLine.deleteMany({
              where: { journalEntryId: existingJE.id },
            });
            await tx.journalEntry.delete({
              where: { id: existingJE.id },
            });
          });
          removedCount++;
        }
        continue;
      }

      if (amount <= 0) continue;

      const isCustomer = inv.customerId != null || inv.profile === "Customer";
      const isVendor = !isCustomer && (inv.vendorId != null || inv.profile === "Vendor");

      const entryDate =
        inv.shipment?.shipmentDate || inv.invoiceDate || inv.createdAt || new Date();
      const tracking =
        inv.shipment?.trackingId || inv.trackingNumber || invNum;

      // 2. If no JE exists, create it
      if (!existingJE) {
        seqCounter += 1;
        const entryNumber = `JE-${String(seqCounter).padStart(4, "0")}`;

        if (isCustomer) {
          await prisma.journalEntry.create({
            data: {
              organizationId: orgId,
              entryNumber,
              date: entryDate,
              description: `Customer invoice for shipment ${tracking}`,
              reference: invNum,
              totalDebit: amount,
              totalCredit: amount,
              isPosted: true,
              postedAt: entryDate,
              lines: {
                create: [
                  {
                    accountId: arAccount.id,
                    debitAmount: amount,
                    creditAmount: 0,
                    description: "Debit: Customer owes money",
                    reference: invNum,
                  },
                  {
                    accountId: revenueAccount.id,
                    debitAmount: 0,
                    creditAmount: amount,
                    description: "Credit: Revenue earned",
                    reference: invNum,
                  },
                ],
              },
            },
          });
          createdCount++;
        } else if (isVendor) {
          await prisma.journalEntry.create({
            data: {
              organizationId: orgId,
              entryNumber,
              date: entryDate,
              description: `Vendor invoice for shipment ${tracking}`,
              reference: invNum,
              totalDebit: amount,
              totalCredit: amount,
              isPosted: true,
              postedAt: entryDate,
              lines: {
                create: [
                  {
                    accountId: expenseAccount.id,
                    debitAmount: amount,
                    creditAmount: 0,
                    description: "Debit: Expense incurred",
                    reference: invNum,
                  },
                  {
                    accountId: apAccount.id,
                    debitAmount: 0,
                    creditAmount: amount,
                    description: "Credit: Accounts payable increased",
                    reference: invNum,
                  },
                ],
              },
            },
          });
          createdCount++;
        }
      } else {
        // 3. If JE exists, check for amount, date, or line account discrepancies
        const amountDiff = Math.abs(Number(existingJE.totalDebit) - amount) > 0.009;
        const existingDate = new Date(existingJE.date).toISOString().slice(0, 10);
        const targetDate = new Date(entryDate).toISOString().slice(0, 10);
        const dateDiff = existingDate !== targetDate;

        const revOrExpLine = existingJE.lines.find(
          (l) => l.accountId === revenueAccount.id || l.accountId === expenseAccount.id
        );
        const missingExpectedLine = !revOrExpLine;

        if (amountDiff || dateDiff || missingExpectedLine) {
          await prisma.$transaction(async (tx) => {
            await tx.journalEntry.update({
              where: { id: existingJE.id },
              data: {
                date: entryDate,
                postedAt: entryDate,
                totalDebit: amount,
                totalCredit: amount,
                description: isCustomer
                  ? `Customer invoice for shipment ${tracking}`
                  : `Vendor invoice for shipment ${tracking}`,
              },
            });

            await tx.journalEntryLine.deleteMany({
              where: { journalEntryId: existingJE.id },
            });

            if (isCustomer) {
              await tx.journalEntryLine.createMany({
                data: [
                  {
                    journalEntryId: existingJE.id,
                    accountId: arAccount.id,
                    debitAmount: amount,
                    creditAmount: 0,
                    description: "Debit: Customer owes money",
                    reference: invNum,
                  },
                  {
                    journalEntryId: existingJE.id,
                    accountId: revenueAccount.id,
                    debitAmount: 0,
                    creditAmount: amount,
                    description: "Credit: Revenue earned",
                    reference: invNum,
                  },
                ],
              });
            } else if (isVendor) {
              await tx.journalEntryLine.createMany({
                data: [
                  {
                    journalEntryId: existingJE.id,
                    accountId: expenseAccount.id,
                    debitAmount: amount,
                    creditAmount: 0,
                    description: "Debit: Expense incurred",
                    reference: invNum,
                  },
                  {
                    journalEntryId: existingJE.id,
                    accountId: apAccount.id,
                    debitAmount: 0,
                    creditAmount: amount,
                    description: "Credit: Accounts payable increased",
                    reference: invNum,
                  },
                ],
              });
            }
          });
          updatedCount++;
        }
      }
    }

    if (createdCount > 0 || updatedCount > 0 || removedCount > 0) {
      console.log(
        `[reconcileInvoiceJournalEntries] Auto-reconciled invoices: created=${createdCount}, updated=${updatedCount}, removed=${removedCount}`
      );
    }

    return { created: createdCount, updated: updatedCount, removed: removedCount };
  } catch (err) {
    console.error("Failed to reconcile invoice journal entries:", err);
    return { created: 0, updated: 0, removed: 0 };
  }
}
