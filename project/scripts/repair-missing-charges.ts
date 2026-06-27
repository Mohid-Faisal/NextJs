/**
 * REPAIR: rebuild missing customer DEBIT (shipment charge) ledger rows.
 *
 * Background: the shipment DELETE endpoint used to delete customer ledger rows
 * using an unscoped, fuzzy `description CONTAINS` match. Deleting one shipment
 * therefore wiped unrelated customers' charge rows while leaving their invoices,
 * shipments and payments intact. This script reconstructs the missing DEBIT rows
 * from the surviving (non-cancelled) Customer invoices + shipments, then recomputes
 * each affected customer's running balances and currentBalance using the SAME
 * voucher-date logic as the app.
 *
 * Safety:
 *   - DRY RUN by default. Prints exactly what it would insert. Writes nothing.
 *   - Pass --apply to actually insert rows and recompute balances.
 *   - Optionally pass --customer=<id> to limit to a single customer.
 *
 * Usage (PowerShell), pointed at the target DB via DATABASE_URL:
 *   $env:DATABASE_URL="postgresql://...":  npx tsx scripts/repair-missing-charges.ts
 *   $env:DATABASE_URL="postgresql://...":  npx tsx scripts/repair-missing-charges.ts --apply
 *   $env:DATABASE_URL="postgresql://...":  npx tsx scripts/repair-missing-charges.ts --customer=2130 --apply
 */
import { prisma } from "../src/lib/prisma";
import { resolveCreditPaymentVoucherDate } from "../src/lib/accounts/resolveCreditPaymentVoucherDate";
import { debitVoucherDateFromInvoice } from "../src/lib/accounts/invoiceDebitVoucherDate";
import { isCustomerCreditNoteReference } from "../src/lib/noteFormats";

const APPLY = process.argv.includes("--apply");
const RECOMPUTE_ONLY = process.argv.includes("--recompute-only");
const customerArg = process.argv.find((a) => a.startsWith("--customer="));
const ONLY_CUSTOMER = customerArg ? parseInt(customerArg.split("=")[1]) : null;

type PlannedInsert = {
  customerId: number;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  description: string;
  reference: string;
  createdAt: Date;
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** Retry a DB operation a few times on transient connection errors (e.g. pooler drops). */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const transient = e?.code === "P1001" || e?.code === "P1017" || /Can't reach database|Closed|Connection/i.test(String(e?.message));
      if (!transient || i === attempts) throw e;
      const wait = 1000 * i;
      console.warn(`  [retry ${i}/${attempts}] ${label} failed (${e?.code || e?.message}); retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function buildPlan(): Promise<PlannedInsert[]> {
  // Bulk fetch everything in a handful of queries (avoids thousands of round-trips).
  const customers = await withRetry("customers", () =>
    prisma.customers.findMany({
      where: ONLY_CUSTOMER ? { id: ONLY_CUSTOMER } : undefined,
      select: { id: true, CompanyName: true },
    })
  );
  const customerNameById = new Map(customers.map((c) => [c.id, c.CompanyName.trim()]));
  const customerIdFilter = ONLY_CUSTOMER ? { customerId: ONLY_CUSTOMER } : { customerId: { not: null } };

  const invoices = await withRetry("invoices", () =>
    prisma.invoice.findMany({
      where: { profile: "Customer", status: { not: "Cancelled" }, ...(customerIdFilter as any) },
      select: {
        invoiceNumber: true,
        totalAmount: true,
        invoiceDate: true,
        customerId: true,
        shipment: {
          select: {
            trackingId: true,
            destination: true,
            packaging: true,
            totalWeight: true,
            weight: true,
            shipmentDate: true,
          },
        },
      },
    })
  );

  const debitTxns = await withRetry("debitTxns", () =>
    prisma.customerTransaction.findMany({
      where: { type: "DEBIT", ...(ONLY_CUSTOMER ? { customerId: ONLY_CUSTOMER } : {}) },
      select: { customerId: true, invoice: true, reference: true },
    })
  );

  // covered[customerId] = set of invoice numbers already charged
  const coveredByCustomer = new Map<number, Set<string>>();
  for (const t of debitTxns) {
    let set = coveredByCustomer.get(t.customerId);
    if (!set) {
      set = new Set<string>();
      coveredByCustomer.set(t.customerId, set);
    }
    if (t.invoice) set.add(t.invoice);
    if (t.reference) set.add(t.reference.replace(/^(CREDIT|REFUND)-/, ""));
  }

  const plan: PlannedInsert[] = [];
  for (const inv of invoices) {
    if (inv.customerId == null) continue;
    const covered = coveredByCustomer.get(inv.customerId);
    if (covered && covered.has(inv.invoiceNumber)) continue;

    let description = `Shipment charge for invoice ${inv.invoiceNumber}`;
    let createdAt: Date = inv.invoiceDate ?? new Date();
    const s = inv.shipment;
    if (s) {
      const wt = s.totalWeight && s.totalWeight > 0 ? s.totalWeight : s.weight;
      description = `Tracking: ${s.trackingId ?? ""} | Country: ${s.destination ?? ""} | Type: ${s.packaging ?? ""} | Weight: ${wt}Kg`;
      if (s.shipmentDate) createdAt = s.shipmentDate;
    }
    plan.push({
      customerId: inv.customerId,
      customerName: customerNameById.get(inv.customerId) ?? String(inv.customerId),
      invoiceNumber: inv.invoiceNumber,
      amount: inv.totalAmount || 0,
      description,
      reference: inv.invoiceNumber,
      createdAt,
    });
  }
  return plan;
}

/** Faithful replication of the app's heavy-path balance recalculation. */
async function recomputeCustomer(customerId: number) {
  const allTransactions = await prisma.customerTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, amount: true, createdAt: true, invoice: true, reference: true },
  });
  if (allTransactions.length === 0) {
    await prisma.customers.update({ where: { id: customerId }, data: { currentBalance: 0 } });
    return 0;
  }

  const creditNoteRefs = uniq(
    allTransactions.filter((t) => isCustomerCreditNoteReference(t.reference)).map((t) => t.reference!)
  );
  const creditNotesMap = new Map<string, Date>();
  if (creditNoteRefs.length > 0) {
    const cns = await prisma.creditNote.findMany({
      where: { creditNoteNumber: { in: creditNoteRefs } },
      select: { creditNoteNumber: true, date: true },
    });
    cns.forEach((cn) => cn.date && creditNotesMap.set(cn.creditNoteNumber, cn.date));
  }

  const invoiceNumbers = uniq(allTransactions.filter((t) => t.invoice).map((t) => t.invoice!));
  const invoicesMap = new Map<string, { shipmentDate?: Date; invoiceDate?: Date }>();
  if (invoiceNumbers.length > 0) {
    const invs = await prisma.invoice.findMany({
      where: { invoiceNumber: { in: invoiceNumbers } },
      include: { shipment: { select: { shipmentDate: true } } },
    });
    invs.forEach((inv) =>
      invoicesMap.set(inv.invoiceNumber, {
        shipmentDate: inv.shipment?.shipmentDate || undefined,
        invoiceDate: inv.invoiceDate,
      })
    );
  }

  const creditTx = allTransactions.filter((t) => t.type === "CREDIT");
  const creditInv = creditTx.filter((t) => t.invoice).map((t) => t.invoice!);
  const creditRef = creditTx.filter((t) => t.reference).map((t) => t.reference!);
  let payments: Array<{ id: number; date: Date; amount: number; invoice: string | null; reference: string | null }> = [];
  if (creditInv.length > 0 || creditRef.length > 0) {
    payments = await prisma.payment.findMany({
      where: {
        fromCustomerId: customerId,
        transactionType: "INCOME",
        OR: [
          ...(creditRef.length ? [{ reference: { in: uniq(creditRef) } }] : []),
          ...(creditInv.length ? [{ invoice: { in: uniq(creditInv) } }] : []),
        ],
      },
      select: { id: true, invoice: true, reference: true, date: true, amount: true },
      orderBy: { date: "desc" },
    });
  }

  const withV = allTransactions.map((t) => {
    let voucherDate = t.createdAt;
    if (t.reference) {
      const cnDate = creditNotesMap.get(t.reference);
      if (cnDate) voucherDate = cnDate;
    }
    if (t.type === "CREDIT") {
      const fromCN = t.reference && creditNotesMap.has(t.reference);
      if (!fromCN) {
        const pd = resolveCreditPaymentVoucherDate(
          { amount: t.amount, invoice: t.invoice, reference: t.reference, createdAt: t.createdAt },
          payments
        );
        if (pd) voucherDate = pd;
      }
    } else if (t.invoice) {
      const vd = debitVoucherDateFromInvoice(invoicesMap.get(t.invoice));
      if (vd) voucherDate = vd;
    }
    return { ...t, voucherDate };
  });

  withV.sort((a, b) => {
    const d = a.voucherDate.getTime() - b.voucherDate.getTime();
    if (d !== 0) return d;
    if (a.type === "DEBIT" && b.type === "CREDIT") return -1;
    if (a.type === "CREDIT" && b.type === "DEBIT") return 1;
    if (a.invoice && b.invoice) {
      const ia = parseInt(a.invoice, 10);
      const ib = parseInt(b.invoice, 10);
      if (!Number.isNaN(ia) && !Number.isNaN(ib)) return ia - ib;
      return a.invoice.localeCompare(b.invoice);
    }
    return 0;
  });

  const startingTx = withV.find((t) => t.reference && t.reference.startsWith("STARTING-BALANCE"));
  let running = 0;
  if (startingTx) {
    running = startingTx.type === "DEBIT" ? -startingTx.amount : startingTx.amount;
  }

  const updates: Array<{ id: number; previousBalance: number; newBalance: number }> = [];
  for (const t of withV) {
    if (t.reference && t.reference.startsWith("STARTING-BALANCE")) continue;
    const prev = running;
    running = t.type === "CREDIT" ? prev + t.amount : prev - t.amount;
    updates.push({ id: t.id, previousBalance: prev, newBalance: running });
  }
  if (startingTx) {
    const sb = startingTx.type === "DEBIT" ? -startingTx.amount : startingTx.amount;
    updates.push({ id: startingTx.id, previousBalance: 0, newBalance: sb });
  }

  // Bounded concurrency — unbounded Promise.all overruns the connection pool,
  // but fully sequential is too slow over a remote pooler. Keep below the pool limit.
  const CONCURRENCY = 8;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const batch = updates.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map((u) =>
        prisma.customerTransaction.update({
          where: { id: u.id },
          data: { previousBalance: u.previousBalance, newBalance: u.newBalance },
        })
      )
    );
  }
  await prisma.customers.update({ where: { id: customerId }, data: { currentBalance: running } });
  return running;
}

async function main() {
  // Recompute-only: rebuild running balances + currentBalance for every customer
  // that has ledger rows. Inserts nothing. Used to finish a repair after inserts.
  if (RECOMPUTE_ONLY) {
    console.log(`Mode: RECOMPUTE ONLY${ONLY_CUSTOMER ? ` | customer=${ONLY_CUSTOMER}` : ""}`);
    const grouped = await withRetry("distinct customers", () =>
      prisma.customerTransaction.groupBy({
        by: ["customerId"],
        where: ONLY_CUSTOMER ? { customerId: ONLY_CUSTOMER } : undefined,
      })
    );
    const ids = grouped.map((g) => g.customerId).sort((a, b) => a - b);
    console.log(`Recomputing ${ids.length} customers with ledger rows...`);
    let done = 0;
    for (const id of ids) {
      const bal = await withRetry(`recompute ${id}`, () => recomputeCustomer(id));
      done++;
      if (done % 25 === 0 || done === ids.length) console.log(`  [${done}/${ids.length}] cust ${id} -> currentBalance=${bal}`);
    }
    console.log(`\nRecomputed ${done} customers. Done.`);
    return;
  }

  console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}${ONLY_CUSTOMER ? ` | customer=${ONLY_CUSTOMER}` : ""}`);
  const plan = await buildPlan();

  const byCustomer = new Map<number, { name: string; count: number; amount: number }>();
  for (const p of plan) {
    const e = byCustomer.get(p.customerId) || { name: p.customerName, count: 0, amount: 0 };
    e.count++;
    e.amount += p.amount;
    byCustomer.set(p.customerId, e);
  }

  console.log(`\nPlanned charge rebuilds: ${plan.length} rows across ${byCustomer.size} customers`);
  const sorted = [...byCustomer.entries()].sort((a, b) => b[1].amount - a[1].amount);
  for (const [id, e] of sorted) {
    console.log(`  cust ${id} ${e.name} | rebuild ${e.count} charge(s) ~${e.amount}`);
  }
  const totalAmt = plan.reduce((s, p) => s + p.amount, 0);
  console.log(`\nTotal rows: ${plan.length} | Total amount: ${totalAmt}`);

  if (!APPLY) {
    console.log("\nDRY RUN complete. Re-run with --apply to write these changes.");
    return;
  }

  console.log("\nApplying inserts (batched)...");
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < plan.length; i += CHUNK) {
    const chunk = plan.slice(i, i + CHUNK);
    await withRetry(`createMany@${i}`, () =>
      prisma.customerTransaction.createMany({
        data: chunk.map((p) => ({
          customerId: p.customerId,
          type: "DEBIT",
          amount: p.amount,
          description: p.description,
          reference: p.reference,
          invoice: p.invoiceNumber,
          previousBalance: 0,
          newBalance: 0,
          createdAt: p.createdAt,
        })),
      })
    );
    inserted += chunk.length;
    console.log(`  inserted ${inserted}/${plan.length}`);
  }
  console.log(`Inserted ${inserted} charge rows.`);

  console.log("\nRecomputing balances for affected customers...");
  let done = 0;
  for (const [id, e] of byCustomer) {
    const bal = await withRetry(`recompute ${id}`, () => recomputeCustomer(id));
    done++;
    console.log(`  [${done}/${byCustomer.size}] cust ${id} ${e.name} -> currentBalance=${bal}`);
  }
  console.log(`\nRecomputed ${done} customers. Repair complete.`);
}

main().catch(console.error).finally(() => process.exit(0));
