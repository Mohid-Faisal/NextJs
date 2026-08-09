/**
 * Backfill missing VENDOR_DEBIT expense journal entries for Aug 2026 PSS vendor invoices.
 * Idempotent: skips if a "Vendor invoice" JE already exists for the invoice number.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ORG_ID = 1;

function dashMonthRange(year, monthIndex) {
  return {
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 1),
  };
}

async function nextJeNumber() {
  const last = await prisma.journalEntry.findFirst({
    where: { organizationId: ORG_ID },
    orderBy: { entryNumber: "desc" },
  });
  if (!last) return "JE-0001";
  const n = parseInt(String(last.entryNumber).split("-")[1], 10);
  return `JE-${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, "0")}`;
}

async function main() {
  const { start, end } = dashMonthRange(2026, 7); // August

  const expense = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId: ORG_ID,
      category: "Expense",
      accountName: "Vendor Expense",
    },
  });
  const ap = await prisma.chartOfAccount.findFirst({
    where: { organizationId: ORG_ID, accountName: "Accounts Payable" },
  });
  if (!expense || !ap) {
    throw new Error(`Missing accounts Expense=${!!expense} AP=${!!ap}`);
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: ORG_ID,
      vendorId: { not: null },
      status: { not: "Cancelled" },
      shipment: {
        shipmentDate: { gte: start, lt: end },
      },
    },
    include: {
      shipment: {
        select: { shipmentDate: true, trackingId: true },
      },
      vendor: { select: { CompanyName: true } },
    },
    orderBy: { id: "asc" },
  });

  const invoiceTotal = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  console.log(
    "VENDOR_INVOICES",
    invoices.length,
    "TOTAL",
    invoiceTotal,
    invoices.map((i) => ({
      n: i.invoiceNumber,
      amt: i.totalAmount,
      status: i.status,
      vendor: i.vendor?.CompanyName,
      track: i.shipment?.trackingId,
    }))
  );

  const results = [];

  for (const inv of invoices) {
    const existing = await prisma.journalEntry.findFirst({
      where: {
        organizationId: ORG_ID,
        reference: inv.invoiceNumber,
        description: { contains: "Vendor invoice" },
      },
    });

    if (existing) {
      results.push({
        invoice: inv.invoiceNumber,
        status: "already_exists",
        entryNumber: existing.entryNumber,
        amount: inv.totalAmount,
      });
      continue;
    }

    if (!(inv.totalAmount > 0)) {
      results.push({
        invoice: inv.invoiceNumber,
        status: "skipped_zero_amount",
        amount: inv.totalAmount,
      });
      continue;
    }

    const amount = inv.totalAmount;
    const entryDate =
      inv.shipment?.shipmentDate || inv.invoiceDate || inv.createdAt;
    const tracking =
      inv.shipment?.trackingId || inv.trackingNumber || inv.invoiceNumber;
    const entryNumber = await nextJeNumber();

    const entry = await prisma.journalEntry.create({
      data: {
        organizationId: ORG_ID,
        entryNumber,
        date: entryDate,
        description: `Vendor invoice for shipment ${tracking}`,
        reference: inv.invoiceNumber,
        totalDebit: amount,
        totalCredit: amount,
        isPosted: true,
        postedAt: entryDate,
        lines: {
          create: [
            {
              accountId: expense.id,
              debitAmount: amount,
              creditAmount: 0,
              description: "Debit: Expense incurred",
              reference: inv.invoiceNumber,
            },
            {
              accountId: ap.id,
              debitAmount: 0,
              creditAmount: amount,
              description: "Credit: Accounts payable increased",
              reference: inv.invoiceNumber,
            },
          ],
        },
      },
    });

    results.push({
      invoice: inv.invoiceNumber,
      status: "created",
      entryNumber: entry.entryNumber,
      amount,
      date: entryDate.toISOString(),
    });
  }

  // Verify August Vendor Expense GL
  const isStart = new Date("2026-08-01T00:00:00.000Z");
  const isEnd = new Date("2026-08-31T23:59:59.999Z");
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: expense.id,
      journalEntry: {
        organizationId: ORG_ID,
        date: { gte: isStart, lte: isEnd },
      },
    },
    select: { debitAmount: true, creditAmount: true },
  });
  const glExpense = lines.reduce(
    (s, l) => s + ((l.debitAmount || 0) - (l.creditAmount || 0)),
    0
  );

  const created = results.filter((r) => r.status === "created");
  const missingBefore = created.reduce((s, r) => s + r.amount, 0);

  console.log(
    JSON.stringify(
      {
        results,
        createdCount: created.length,
        backfilledAmount: missingBefore,
        vendorInvoiceTotalPositive: invoices
          .filter((i) => i.totalAmount > 0)
          .reduce((s, i) => s + i.totalAmount, 0),
        glVendorExpenseAugust: glExpense,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
