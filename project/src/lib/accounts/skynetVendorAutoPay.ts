import { format } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import {
  type ChartAccountRow,
  resolveVendorPaymentAccountIds,
} from "@/lib/accounts/vendorPaymentAccounts";

/** Matches "Skynet Worldwide Express" and common variants (case-insensitive). */
export function isSkynetWorldwideExpressVendor(companyName: string): boolean {
  const n = companyName.toLowerCase().trim();
  return (
    n.includes("skynet") &&
    n.includes("worldwide") &&
    n.includes("express")
  );
}

/** Matches "APX Logistics" and common variants (case-insensitive). */
export function isApxLogisticsVendor(companyName: string): boolean {
  const n = companyName.toLowerCase().trim();
  return n.includes("apx") && n.includes("logistics");
}

async function vendorExpensePaidTotalsByInvoice(
  prisma: PrismaClient,
  invoiceNumbers: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (invoiceNumbers.length === 0) return map;

  const rows = await prisma.payment.groupBy({
    by: ["invoice"],
    where: {
      transactionType: "EXPENSE",
      invoice: { in: invoiceNumbers },
    },
    _sum: { amount: true },
  });

  for (const row of rows) {
    if (row.invoice != null && row.invoice !== "") {
      map.set(row.invoice, row._sum.amount ?? 0);
    }
  }
  return map;
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/** Generate JE numbers above any existing numeric suffix and any concurrent millisecond-timestamp suffix. */
async function getJournalEntryBase(prisma: PrismaClient): Promise<number> {
  let maxExisting = 0;
  try {
    const rows = await prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(SUBSTRING(\`entryNumber\` FROM 4) AS SIGNED)) AS max
      FROM \`JournalEntry\`
      WHERE \`entryNumber\` REGEXP '^JE-[0-9]+$'
    `;
    maxExisting = Number(rows[0]?.max ?? 0) || 0;
  } catch {
    const last = await prisma.journalEntry.findFirst({
      orderBy: { id: "desc" },
      select: { entryNumber: true },
    });
    const n = last ? parseInt(last.entryNumber.split("-")[1] ?? "", 10) : 0;
    maxExisting = Number.isFinite(n) ? n : 0;
  }
  // Use Date.now()*1000 as a base so we sit above any "JE-${Date.now()}" entries
  // that other code paths in the app may produce concurrently.
  const tsBase = Date.now() * 1000;
  return Math.max(maxExisting, tsBase) + 1;
}

export type VendorBulkAutoPayRow = {
  invoiceNumber: string;
  success: boolean;
  skipped?: boolean;
  amount?: number;
  paymentDate?: string;
  message?: string;
};

export type VendorBulkAutoPayResult = {
  success: boolean;
  vendorId: number;
  vendorName: string;
  summary: {
    invoicesConsidered: number;
    paymentsCreated: number;
    skippedAlreadyPaid: number;
    failed: number;
  };
  results: VendorBulkAutoPayRow[];
};

export type VendorBulkAutoPayOptions = {
  /** Optional hook for CLI / logs (one line per call). */
  onProgress?: (line: string) => void;
  organizationId?: number;
};

/** Payment methods supported by the bulk vendor auto-pay (subset of Prisma PaymentMode). */
export type VendorPaymentMethod = "CASH" | "BANK_TRANSFER";

export type VendorBulkAutoPayConfig = {
  paymentMethod: VendorPaymentMethod;
  description: string;
  /** Optional defense-in-depth: reject if vendor.CompanyName doesn't match. */
  validateVendor?: (companyName: string) => boolean;
  /** Error message returned if validateVendor fails. */
  vendorMismatchMessage?: string;
};

/** Generic Skynet/APX-style bulk auto-pay: settles every unpaid Vendor invoice for the given vendor. */
export async function runVendorBulkAutoPay(
  prisma: PrismaClient,
  vendorId: number,
  config: VendorBulkAutoPayConfig,
  options?: VendorBulkAutoPayOptions
): Promise<
  | { ok: true; data: VendorBulkAutoPayResult }
  | { ok: false; status: number; error: string }
> {
  const log = options?.onProgress;
  const organizationId = options?.organizationId;
  if (!Number.isFinite(vendorId)) {
    return { ok: false, status: 400, error: "Valid vendorId is required" };
  }

  const vendor = await prisma.vendors.findFirst({
    where: {
      id: vendorId,
      ...(organizationId != null ? { organizationId } : {}),
    },
  });
  if (!vendor) {
    return { ok: false, status: 404, error: "Vendor not found" };
  }

  if (config.validateVendor && !config.validateVendor(vendor.CompanyName)) {
    return {
      ok: false,
      status: 403,
      error:
        config.vendorMismatchMessage ??
        "Vendor name does not match the expected pattern for this auto-pay.",
    };
  }

  const accounts = await prisma.chartOfAccount.findMany({
    where: { isActive: true },
  });
  const coaRows: ChartAccountRow[] = accounts.map((a) => ({
    id: a.id,
    accountName: a.accountName,
    category: a.category,
  }));

  const accountIds = resolveVendorPaymentAccountIds(coaRows, config.paymentMethod);
  if (!accountIds) {
    const credit =
      config.paymentMethod === "CASH" ? "Cash" : "Bank Account";
    return {
      ok: false,
      status: 400,
      error: `Could not resolve chart of accounts (Accounts Payable / ${credit})`,
    };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      vendorId,
      profile: "Vendor",
      ...(organizationId != null ? { organizationId } : {}),
    },
    include: {
      shipment: { select: { shipmentDate: true } },
      vendor: { select: { id: true, CompanyName: true } },
    },
    orderBy: [{ invoiceDate: "asc" }, { id: "asc" }],
  });

  const paidByInvoice = await vendorExpensePaidTotalsByInvoice(
    prisma,
    invoices.map((i) => i.invoiceNumber)
  );

  let nextJENum = await getJournalEntryBase(prisma);
  let runningVendorBalance = vendor.currentBalance;

  log?.(
    `Vendor ${vendor.CompanyName} (id=${vendorId}); method=${config.paymentMethod}; description="${config.description}".`
  );
  log?.(
    `Found ${invoices.length} vendor invoice(s); loaded payment totals; next JE = JE-${nextJENum}.`
  );

  const results: VendorBulkAutoPayRow[] = [];

  const PAYMENT_METHOD = config.paymentMethod;
  const DESCRIPTION = config.description;
  const total = invoices.length;

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    const idx = i + 1;

    const paid = paidByInvoice.get(inv.invoiceNumber) ?? 0;
    const remaining = Math.round(Math.max(0, inv.totalAmount - paid) * 100) / 100;
    const EPS = 0.005;

    if (remaining <= EPS) {
      log?.(`[${idx}/${total}] ${inv.invoiceNumber} — skip (already paid)`);
      results.push({
        invoiceNumber: inv.invoiceNumber,
        success: true,
        skipped: true,
        message: "Already paid",
      });
      continue;
    }

    const dateSource = inv.shipment?.shipmentDate ?? inv.invoiceDate;
    const paymentDate = new Date(dateSource);
    const paymentDateStr = format(paymentDate, "yyyy-MM-dd");
    const reference = inv.invoiceNumber;

    log?.(
      `[${idx}/${total}] ${inv.invoiceNumber} — paying ${remaining.toFixed(2)} (date ${paymentDateStr})…`
    );

    const previousBalance = runningVendorBalance;
    const newBalance = previousBalance - remaining;

    let txError: unknown = null;
    let committed = false;

    for (let bump = 0; bump < 5 && !committed; bump++) {
      const entryNumber = `JE-${nextJENum + bump}`;
      try {
        await prisma.$transaction(
          async (tx) => {
            await tx.payment.create({
              data: {
                ...(organizationId != null ? { organizationId } : {}),
                transactionType: "EXPENSE",
                category: "Vendor Payment",
                date: paymentDate,
                amount: remaining,
                fromPartyType: "US",
                fromCustomerId: null,
                fromCustomer: "",
                toPartyType: "VENDOR",
                toVendorId: vendorId,
                toVendor: vendor.CompanyName ?? "",
                mode: PAYMENT_METHOD,
                reference,
                invoice: inv.invoiceNumber,
                description: DESCRIPTION,
              },
            });

            await tx.vendorTransaction.create({
              data: {
                ...(organizationId != null ? { organizationId } : {}),
                vendorId,
                type: "CREDIT",
                amount: remaining,
                description: DESCRIPTION,
                reference,
                invoice: inv.invoiceNumber,
                previousBalance,
                newBalance,
                createdAt: paymentDate,
              },
            });

            await tx.vendors.update({
              where: { id: vendorId },
              data: { currentBalance: newBalance },
            });

            await tx.invoice.update({
              where: { invoiceNumber: inv.invoiceNumber },
              data: { status: "Paid" },
            });

            await tx.journalEntry.create({
              data: {
                ...(organizationId != null ? { organizationId } : {}),
                entryNumber,
                date: paymentDate,
                description: `Invoice Payment: Vendor payment for ${inv.invoiceNumber} - ${DESCRIPTION}`,
                reference,
                totalDebit: remaining,
                totalCredit: remaining,
                isPosted: true,
                postedAt: paymentDate,
                lines: {
                  create: [
                    {
                      accountId: accountIds.debitAccountId,
                      debitAmount: remaining,
                      creditAmount: 0,
                      description: "Debit: Vendor payment",
                      reference,
                    },
                    {
                      accountId: accountIds.creditAccountId,
                      debitAmount: 0,
                      creditAmount: remaining,
                      description: "Credit: Vendor payment",
                      reference,
                    },
                  ],
                },
              },
            });
          },
          { timeout: 60_000, maxWait: 30_000 }
        );
        committed = true;
        nextJENum += bump + 1;
      } catch (e) {
        txError = e;
        if (isUniqueViolation(e)) {
          // JE number collided (other code paths or a previous "dirty commit"); try a higher number.
          continue;
        }
        // Non-unique error: maybe Prisma reported failure but Postgres actually committed
        // (interactive-style timeouts can do that). Re-check the invoice status to recover.
        try {
          const check = await prisma.invoice.findUnique({
            where: { invoiceNumber: inv.invoiceNumber },
            select: { status: true },
          });
          if (check?.status === "Paid") {
            committed = true;
            nextJENum += bump + 1;
            break;
          }
        } catch {
          // ignore re-check failure; treat as failed below
        }
        break;
      }
    }

    if (committed) {
      runningVendorBalance = newBalance;
      results.push({
        invoiceNumber: inv.invoiceNumber,
        success: true,
        skipped: false,
        amount: remaining,
        paymentDate: paymentDateStr,
      });
      log?.(`[${idx}/${total}] ${inv.invoiceNumber} — paid`);
    } else {
      const msg = txError instanceof Error ? txError.message : "Payment failed";
      results.push({
        invoiceNumber: inv.invoiceNumber,
        success: false,
        message: msg,
      });
      log?.(`[${idx}/${total}] ${inv.invoiceNumber} — FAILED: ${msg}`);
    }
  }

  const paidCount = results.filter((r) => r.success && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const failedCount = results.filter((r) => !r.success).length;

  log?.(
    `Finished: ${paidCount} payment(s) created, ${skippedCount} skipped (already paid), ${failedCount} failed.`
  );

  return {
    ok: true,
    data: {
      success: failedCount === 0,
      vendorId,
      vendorName: vendor.CompanyName,
      summary: {
        invoicesConsidered: invoices.length,
        paymentsCreated: paidCount,
        skippedAlreadyPaid: skippedCount,
        failed: failedCount,
      },
      results,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backwards-compatible Skynet wrappers + types
// ─────────────────────────────────────────────────────────────────────────────

export type SkynetVendorAutoPayRow = VendorBulkAutoPayRow;
export type SkynetVendorAutoPayResult = VendorBulkAutoPayResult;
export type SkynetVendorAutoPayOptions = VendorBulkAutoPayOptions;

export async function runSkynetVendorAutoPay(
  prisma: PrismaClient,
  vendorId: number,
  options?: VendorBulkAutoPayOptions
) {
  return runVendorBulkAutoPay(
    prisma,
    vendorId,
    {
      paymentMethod: "CASH",
      description: "Cash paid",
      validateVendor: isSkynetWorldwideExpressVendor,
      vendorMismatchMessage:
        "This action is only allowed for Skynet Worldwide Express (vendor name must include skynet, worldwide, and express)",
    },
    options
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APX Logistics wrapper (BANK_TRANSFER + "IB- Funds Transfer" description)
// ─────────────────────────────────────────────────────────────────────────────

export async function runApxLogisticsAutoPay(
  prisma: PrismaClient,
  vendorId: number,
  options?: VendorBulkAutoPayOptions
) {
  return runVendorBulkAutoPay(
    prisma,
    vendorId,
    {
      paymentMethod: "BANK_TRANSFER",
      description: "IB- Funds Transfer",
      validateVendor: isApxLogisticsVendor,
      vendorMismatchMessage:
        "This action is only allowed for APX Logistics (vendor name must include apx and logistics)",
    },
    options
  );
}
