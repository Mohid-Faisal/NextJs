/**
 * Backfill missing CUSTOMER_DEBIT revenue journal entries for Aug 2026 PSS invoices
 * that have invoice + customer ledger rows but no revenue JE.
 *
 * Idempotent: skips if a customer-invoice JE already exists for the invoice number.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ORG_ID = 1;

const TO_BACKFILL = [
  { invoiceNumber: "618775", trackingId: "3359633454" },
  { invoiceNumber: "618780", trackingId: "1ZK0F5910438763074" },
  { invoiceNumber: "618785", trackingId: "1ZK0F3060417589911" },
  { invoiceNumber: "618800", trackingId: "000512321855" },
];

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
  const ar = await prisma.chartOfAccount.findFirst({
    where: { organizationId: ORG_ID, accountName: "Accounts Receivable" },
  });
  const revenue = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId: ORG_ID,
      category: "Revenue",
      accountName: "Logistics Services Revenue",
    },
  });
  if (!ar || !revenue) {
    throw new Error(`Missing accounts AR=${!!ar} Revenue=${!!revenue}`);
  }

  const results = [];

  for (const item of TO_BACKFILL) {
    const inv = await prisma.invoice.findFirst({
      where: {
        organizationId: ORG_ID,
        invoiceNumber: item.invoiceNumber,
        customerId: { not: null },
      },
      include: {
        shipment: { select: { shipmentDate: true, trackingId: true } },
      },
    });
    if (!inv) {
      results.push({ invoice: item.invoiceNumber, status: "invoice_not_found" });
      continue;
    }

    const existing = await prisma.journalEntry.findFirst({
      where: {
        organizationId: ORG_ID,
        reference: item.invoiceNumber,
        description: { contains: "Customer invoice" },
      },
    });
    if (existing) {
      results.push({
        invoice: item.invoiceNumber,
        status: "already_exists",
        entryNumber: existing.entryNumber,
      });
      continue;
    }

    const amount = inv.totalAmount;
    if (!(amount > 0)) {
      results.push({ invoice: item.invoiceNumber, status: "zero_amount", amount });
      continue;
    }

    const entryDate = inv.shipment?.shipmentDate || inv.invoiceDate || inv.createdAt;
    const tracking =
      inv.shipment?.trackingId || item.trackingId || inv.trackingNumber || item.invoiceNumber;
    const entryNumber = await nextJeNumber();

    const entry = await prisma.$transaction(async (tx) => {
      const je = await tx.journalEntry.create({
        data: {
          organizationId: ORG_ID,
          entryNumber,
          date: entryDate,
          description: `Customer invoice for shipment ${tracking}`,
          reference: item.invoiceNumber,
          totalDebit: amount,
          totalCredit: amount,
          isPosted: true,
          postedAt: entryDate,
          lines: {
            create: [
              {
                accountId: ar.id,
                debitAmount: amount,
                creditAmount: 0,
                description: "Debit: Customer owes money",
                reference: item.invoiceNumber,
              },
              {
                accountId: revenue.id,
                debitAmount: 0,
                creditAmount: amount,
                description: "Credit: Revenue earned",
                reference: item.invoiceNumber,
              },
            ],
          },
        },
      });
      return je;
    });

    results.push({
      invoice: item.invoiceNumber,
      status: "created",
      entryNumber: entry.entryNumber,
      amount,
      date: entryDate.toISOString(),
    });
  }

  // Verify August totals
  const start = new Date("2026-08-01T00:00:00.000Z");
  const end = new Date("2026-08-31T23:59:59.999Z");
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: revenue.id,
      journalEntry: {
        organizationId: ORG_ID,
        date: { gte: start, lte: end },
      },
    },
    select: { debitAmount: true, creditAmount: true },
  });
  const glRevenue = lines.reduce(
    (s, l) => s + ((l.creditAmount || 0) - (l.debitAmount || 0)),
    0
  );

  console.log(JSON.stringify({ results, glRevenueAugust: glRevenue }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
