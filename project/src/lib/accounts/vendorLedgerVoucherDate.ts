import { resolveCreditPaymentVoucherDate } from "@/lib/accounts/resolveCreditPaymentVoucherDate";
import {
  debitVoucherDateFromInvoice,
  type InvoiceFieldsForDebitVoucher,
} from "@/lib/accounts/invoiceDebitVoucherDate";
import type { PaymentRowForVoucherDate } from "@/lib/accounts/resolveCreditPaymentVoucherDate";

type Tx = {
  type: string;
  invoice: string | null;
  reference: string | null;
  createdAt: Date;
  amount: number;
};

/**
 * Single source of truth for vendor ledger voucher date (matches recalc + dashboard AR/AP).
 */
export function computeVendorLedgerVoucherDate(
  transaction: Tx,
  ctx: {
    debitNotesMap: Map<string, Date>;
    invoicesMap: Map<string, InvoiceFieldsForDebitVoucher>;
    paymentsForVoucher: PaymentRowForVoucherDate[];
  }
): Date {
  let voucherDate = transaction.createdAt;

  if (transaction.reference) {
    const debitNoteDate = ctx.debitNotesMap.get(transaction.reference);
    if (debitNoteDate) voucherDate = debitNoteDate;
  }

  if (transaction.type === "CREDIT") {
    const fromDebitNote =
      transaction.reference && ctx.debitNotesMap.has(transaction.reference);
    if (!fromDebitNote) {
      const paymentDate = resolveCreditPaymentVoucherDate(
        {
          amount: transaction.amount,
          invoice: transaction.invoice,
          reference: transaction.reference,
          createdAt: transaction.createdAt,
        },
        ctx.paymentsForVoucher
      );
      if (paymentDate) voucherDate = paymentDate;
    }
  } else if (transaction.invoice) {
    const invoiceData = ctx.invoicesMap.get(transaction.invoice);
    if (transaction.type === "DEBIT") {
      const vd = debitVoucherDateFromInvoice(invoiceData);
      if (vd) voucherDate = vd;
    }
  }

  return voucherDate;
}
