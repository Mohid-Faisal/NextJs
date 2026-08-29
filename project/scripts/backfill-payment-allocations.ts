/**
 * Backfill PaymentAllocation rows from legacy encodings:
 *  1. Payment.description "ALLOCATIONS:INV:amt|INV:amt"
 *  2. Payments that still have invoice set but no allocation rows
 *
 * Dry-run by default. Pass --apply to write.
 *
 *   npx tsx scripts/backfill-payment-allocations.ts
 *   npx tsx scripts/backfill-payment-allocations.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function parseAllocationsDescription(description: string | null): Array<{
  invoiceNumber: string;
  amount: number;
}> {
  if (!description) return [];
  const marker = "ALLOCATIONS:";
  const idx = description.indexOf(marker);
  if (idx < 0) return [];
  const rest = description.slice(idx + marker.length).trim();
  if (!rest) return [];
  const out: Array<{ invoiceNumber: string; amount: number }> = [];
  for (const part of rest.split("|")) {
    const colon = part.lastIndexOf(":");
    if (colon <= 0) continue;
    const invoiceNumber = part.slice(0, colon).trim();
    const amount = parseFloat(part.slice(colon + 1));
    if (!invoiceNumber || !Number.isFinite(amount) || amount <= 0) continue;
    out.push({ invoiceNumber, amount });
  }
  return out;
}

async function main() {
  const created: Array<{
    organizationId: number;
    paymentId: number;
    invoiceId: number;
    amount: number;
  }> = [];
  const skipped: string[] = [];

  const withDesc = await prisma.payment.findMany({
    where: {
      description: { contains: "ALLOCATIONS:" },
      allocations: { none: {} },
    },
    select: {
      id: true,
      organizationId: true,
      invoice: true,
      amount: true,
      description: true,
    },
  });

  for (const payment of withDesc) {
    const parsed = parseAllocationsDescription(payment.description);
    if (parsed.length === 0) {
      skipped.push(`payment ${payment.id}: ALLOCATIONS: present but unparseable`);
      continue;
    }
    const numbers = parsed.map((p) => p.invoiceNumber);
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: payment.organizationId,
        invoiceNumber: { in: numbers },
      },
      select: { id: true, invoiceNumber: true },
    });
    const byNumber = new Map(invoices.map((i) => [i.invoiceNumber, i.id]));
    const seen = new Set<number>();
    let allocated = 0;
    for (const item of parsed) {
      const invoiceId = byNumber.get(item.invoiceNumber);
      if (invoiceId == null) {
        skipped.push(
          `payment ${payment.id}: invoice ${item.invoiceNumber} not in org ${payment.organizationId}`
        );
        continue;
      }
      created.push({
        organizationId: payment.organizationId,
        paymentId: payment.id,
        invoiceId,
        amount: item.amount,
      });
      seen.add(invoiceId);
      allocated += item.amount;
    }

    // ALLOCATIONS: in the description is only the FIFO excess, not the
    // invoice the payment was taken against. Credit the remainder there.
    const remainder = Number(payment.amount) - allocated;
    if (payment.invoice && remainder > 0.009) {
      let originalId = byNumber.get(payment.invoice);
      if (originalId == null) {
        const original = await prisma.invoice.findUnique({
          where: {
            organizationId_invoiceNumber: {
              organizationId: payment.organizationId,
              invoiceNumber: payment.invoice,
            },
          },
          select: { id: true },
        });
        originalId = original?.id;
      }
      if (originalId == null) {
        skipped.push(
          `payment ${payment.id}: original invoice ${payment.invoice} not in org ${payment.organizationId}`
        );
      } else if (!seen.has(originalId)) {
        created.push({
          organizationId: payment.organizationId,
          paymentId: payment.id,
          invoiceId: originalId,
          amount: remainder,
        });
      }
    }
  }

  const legacy = await prisma.payment.findMany({
    where: {
      invoice: { not: null },
      allocations: { none: {} },
    },
    select: {
      id: true,
      organizationId: true,
      invoice: true,
      amount: true,
      description: true,
    },
  });

  for (const payment of legacy) {
    if (payment.description?.includes("ALLOCATIONS:")) continue;
    if (!payment.invoice) continue;
    const invoice = await prisma.invoice.findUnique({
      where: {
        organizationId_invoiceNumber: {
          organizationId: payment.organizationId,
          invoiceNumber: payment.invoice,
        },
      },
      select: { id: true },
    });
    if (!invoice) {
      skipped.push(
        `payment ${payment.id}: invoice ${payment.invoice} not in org ${payment.organizationId}`
      );
      continue;
    }
    created.push({
      organizationId: payment.organizationId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount: Number(payment.amount),
    });
  }

  console.log(
    `${APPLY ? "Applying" : "Dry-run"}: ${created.length} allocation row(s), ${skipped.length} skipped.`
  );
  if (skipped.length > 0 && skipped.length <= 50) {
    for (const s of skipped) console.log("  skip:", s);
  } else if (skipped.length > 50) {
    for (const s of skipped.slice(0, 20)) console.log("  skip:", s);
    console.log(`  ... ${skipped.length - 20} more`);
  }

  if (APPLY && created.length > 0) {
    await prisma.paymentAllocation.createMany({ data: created });
    console.log(`Wrote ${created.length} PaymentAllocation rows.`);
  } else if (!APPLY) {
    console.log("Re-run with --apply to write rows.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
