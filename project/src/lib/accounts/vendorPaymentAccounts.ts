import type { PrismaClient } from "@prisma/client";

export type ChartAccountRow = {
  id: number;
  accountName: string;
  category: string;
};

/**
 * Matches Expense > Vendor Payments: debit Accounts Payable; credit depends on mode.
 */
export function resolveVendorPaymentAccountIds(
  accounts: ChartAccountRow[],
  paymentMethod: string
): { debitAccountId: number; creditAccountId: number } | null {
  const accountsPayableAccount = accounts.find(
    (a) => a.accountName === "Accounts Payable"
  );
  const cashAccount = accounts.find((a) => a.accountName === "Cash");
  const bankAccount = accounts.find(
    (a) =>
      a.accountName === "Bank Account" ||
      a.accountName === "Bank" ||
      (a.category === "Asset" &&
        a.accountName.toLowerCase().includes("bank"))
  );

  if (!accountsPayableAccount) return null;

  let creditAccount = cashAccount;
  switch (paymentMethod) {
    case "CASH":
      creditAccount = cashAccount;
      break;
    case "BANK_TRANSFER":
    case "CHECK":
    case "CREDIT_CARD":
      creditAccount = bankAccount || cashAccount;
      break;
    default:
      creditAccount = cashAccount;
  }

  if (!creditAccount) return null;

  return {
    debitAccountId: accountsPayableAccount.id,
    creditAccountId: creditAccount.id,
  };
}

export function normalizePaymentMethod(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "CASH";

  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_");

  if (upper === "CASH" || upper === "C") return "CASH";
  if (
    ["BANK_TRANSFER", "BANK", "TRANSFER", "WIRE", "EFT"].includes(upper) ||
    trimmed.toLowerCase().includes("bank") ||
    trimmed.toLowerCase().includes("transfer")
  ) {
    return "BANK_TRANSFER";
  }
  if (
    upper === "CHECK" ||
    upper === "CHEQUE" ||
    trimmed.toLowerCase().includes("check") ||
    trimmed.toLowerCase().includes("cheque")
  ) {
    return "CHECK";
  }
  if (
    upper === "CREDIT_CARD" ||
    upper === "CARD" ||
    (trimmed.toLowerCase().includes("credit") &&
      trimmed.toLowerCase().includes("card"))
  ) {
    return "CREDIT_CARD";
  }

  if (
    ["BANK_TRANSFER", "CHECK", "CREDIT_CARD", "CASH"].includes(upper)
  ) {
    return upper;
  }

  return "CASH";
}

/**
 * Latest vendor bill dated strictly before the payment calendar day (invoiceDate < start of payment date).
 */
export async function findLatestVendorInvoiceBeforePaymentDate(
  prisma: PrismaClient,
  vendorId: number,
  paymentDate: Date
) {
  const dayStart = new Date(paymentDate);
  dayStart.setHours(0, 0, 0, 0);

  return prisma.invoice.findFirst({
    where: {
      vendorId,
      profile: "Vendor",
      invoiceDate: { lt: dayStart },
    },
    orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
    include: { vendor: true },
  });
}
