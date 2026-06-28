import { prisma } from "@/lib/prisma";
import { nextJournalEntryNumber } from "@/lib/tenant/orgJournalChart";

/**
 * Creates a balanced journal entry for a payment processed via /api/accounts/payments/process
 */
export async function createJournalEntryForPaymentProcess(
  payment: { id: number; date?: Date | null },
  body: {
    paymentAmount: number | string;
    paymentType: "CUSTOMER_PAYMENT" | "VENDOR_PAYMENT";
    description?: string;
    paymentDate?: string;
    debitAccountId: number;
    creditAccountId: number;
    reference?: string;
  },
  invoice: { invoiceNumber: string },
  organizationId: number
) {
  const entryNumber = await nextJournalEntryNumber(prisma, organizationId);

  const journalEntry = await prisma.$transaction(async (tx) => {
    const journalEntryDate = body.paymentDate
      ? new Date(body.paymentDate)
      : payment.date
        ? new Date(payment.date)
        : new Date();

    const entry = await tx.journalEntry.create({
      data: {
        organizationId,
        entryNumber,
        date: journalEntryDate,
        description: `Invoice Payment: ${body.paymentType === "CUSTOMER_PAYMENT" ? "Customer" : "Vendor"} payment for ${invoice.invoiceNumber} - ${body.description || "No description"}`,
        reference: body.reference || `Payment-${payment.id}`,
        totalDebit: Number(body.paymentAmount),
        totalCredit: Number(body.paymentAmount),
        isPosted: true,
        postedAt: journalEntryDate,
      },
    });

    await Promise.all([
      tx.journalEntryLine.create({
        data: {
          journalEntryId: entry.id,
          accountId: body.debitAccountId,
          debitAmount: Number(body.paymentAmount),
          creditAmount: 0,
          description: `Debit: ${body.paymentType === "CUSTOMER_PAYMENT" ? "Customer" : "Vendor"} payment`,
          reference: body.reference || `Payment-${payment.id}`,
        },
      }),
      tx.journalEntryLine.create({
        data: {
          journalEntryId: entry.id,
          accountId: body.creditAccountId,
          debitAmount: 0,
          creditAmount: Number(body.paymentAmount),
          description: `Credit: ${body.paymentType === "CUSTOMER_PAYMENT" ? "Customer" : "Vendor"} payment`,
          reference: body.reference || `Payment-${payment.id}`,
        },
      }),
    ]);

    return entry;
  });

  console.log(
    `Created journal entry ${journalEntry.entryNumber} for payment process ${payment.id}`
  );
}
