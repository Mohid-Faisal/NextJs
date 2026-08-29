import { prisma } from "@/lib/prisma";
import { nextJournalEntryNumber } from "@/lib/tenant/orgJournalChart";

/**
 * Creates a balanced journal entry for a payment processed via /api/accounts/payments/process.
 * Pass the transaction client as `db` so the JE number reservation and row
 * inserts commit or roll back with the payment itself.
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
  organizationId: number,
  db: any = prisma
) {
  const entryNumber = await nextJournalEntryNumber(db, organizationId);

  const journalEntryDate = body.paymentDate
    ? new Date(body.paymentDate)
    : payment.date
      ? new Date(payment.date)
      : new Date();

  const paymentKey = `Payment-${payment.id}`;
  const userRef = body.reference ? ` (Ref: ${body.reference})` : "";
  const entry = await db.journalEntry.create({
    data: {
      organizationId,
      entryNumber,
      date: journalEntryDate,
      description: `Invoice Payment: ${body.paymentType === "CUSTOMER_PAYMENT" ? "Customer" : "Vendor"} payment for ${invoice.invoiceNumber} - ${body.description || "No description"}${userRef}`,
      reference: paymentKey,
      totalDebit: Number(body.paymentAmount),
      totalCredit: Number(body.paymentAmount),
      isPosted: true,
      postedAt: journalEntryDate,
    },
  });

  await Promise.all([
    db.journalEntryLine.create({
      data: {
        organizationId,
        journalEntryId: entry.id,
        accountId: body.debitAccountId,
        debitAmount: Number(body.paymentAmount),
        creditAmount: 0,
        description: `Debit: ${body.paymentType === "CUSTOMER_PAYMENT" ? "Customer" : "Vendor"} payment`,
        reference: paymentKey,
      },
    }),
    db.journalEntryLine.create({
      data: {
        organizationId,
        journalEntryId: entry.id,
        accountId: body.creditAccountId,
        debitAmount: 0,
        creditAmount: Number(body.paymentAmount),
        description: `Credit: ${body.paymentType === "CUSTOMER_PAYMENT" ? "Customer" : "Vendor"} payment`,
        reference: paymentKey,
      },
    }),
  ]);

  return entry;
}
