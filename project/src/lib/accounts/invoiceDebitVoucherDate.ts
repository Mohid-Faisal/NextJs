/**
 * Invoice fields used to set voucher date for DEBIT ledger lines (customer + vendor).
 * Matches ordering rules in transaction APIs and dashboard AR/AP trend.
 */
export type InvoiceFieldsForDebitVoucher = {
  shipmentDate?: Date;
  invoiceDate?: Date;
};

/**
 * DEBIT (invoice) lines: prefer shipment date, then invoice date.
 * Avoids using transaction createdAt when shipment is missing — that often sorts
 * bills incorrectly relative to payments (e.g. payment looks “last” while newer bills exist).
 */
export function debitVoucherDateFromInvoice(
  inv: InvoiceFieldsForDebitVoucher | undefined
): Date | undefined {
  if (!inv) return undefined;
  if (inv.shipmentDate) return inv.shipmentDate;
  if (inv.invoiceDate) return inv.invoiceDate;
  return undefined;
}
