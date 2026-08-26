import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

function paymentIdFromReference(ref: string | null | undefined): number | null {
  if (!ref) return null;
  const m = /^(?:Payment|PAY)-(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return Number.isNaN(id) ? null : id;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function deleteJournalEntriesByIds(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  await prisma.$transaction(async (tx) => {
    await tx.journalEntryLine.deleteMany({
      where: { journalEntryId: { in: ids } },
    });
    await tx.journalEntry.deleteMany({
      where: { id: { in: ids } },
    });
  });
  return ids.length;
}

/**
 * Safe cleanup for page loads (Income Statement / Account Books).
 * Only deletes JEs whose reference is exactly Payment-{id} or PAY-{id}
 * and that payment no longer exists. Never uses shared bank-ref heuristics.
 */
export async function cleanupOrphanPaymentJournalEntries(
  session: SessionPayload
): Promise<number> {
  const jes = await prisma.journalEntry.findMany({
    where: {
      organizationId: session.organizationId,
      OR: [
        { reference: { startsWith: "Payment-" } },
        { reference: { startsWith: "PAY-" } },
      ],
    },
    select: { id: true, reference: true },
  });

  const candidateIds: number[] = [];
  const paymentIdsToCheck = new Set<number>();

  for (const je of jes) {
    const pid = paymentIdFromReference(je.reference);
    if (pid == null) continue;
    candidateIds.push(je.id);
    paymentIdsToCheck.add(pid);
  }

  if (candidateIds.length === 0) return 0;

  const existingPayments = await prisma.payment.findMany({
    where: {
      organizationId: session.organizationId,
      id: { in: [...paymentIdsToCheck] },
    },
    select: { id: true },
  });
  const existingIds = new Set(existingPayments.map((p) => p.id));

  const orphanIds = jes
    .filter((je) => {
      const pid = paymentIdFromReference(je.reference);
      return pid != null && !existingIds.has(pid);
    })
    .map((je) => je.id);

  return deleteJournalEntriesByIds(orphanIds);
}

/**
 * Broader cleanup after a payment delete. Also removes legacy shared-ref
 * payment JEs (e.g. reference "Office") that no longer map to any Payment.
 * Still only touches payment-like descriptions / Payment-* refs.
 */
export async function cleanupOrphanPaymentJournalEntriesAfterDelete(
  session: SessionPayload
): Promise<number> {
  // First: unambiguous Payment-{id} orphans
  let removed = await cleanupOrphanPaymentJournalEntries(session);

  const payments = await prisma.payment.findMany({
    where: { organizationId: session.organizationId },
    select: {
      id: true,
      reference: true,
      amount: true,
      date: true,
      category: true,
    },
  });
  const paymentById = new Map(payments.map((p) => [p.id, p]));

  const jes = await prisma.journalEntry.findMany({
    where: {
      organizationId: session.organizationId,
      OR: [
        { description: { startsWith: "Payment:" } },
        { description: { startsWith: "Invoice Payment:" } },
      ],
    },
    select: {
      id: true,
      reference: true,
      description: true,
      date: true,
      totalDebit: true,
    },
  });

  // Skip JEs that already have a unique Payment-{id} pointing at an existing payment
  const claimedPayments = new Set<number>();
  const claimedJEs = new Set<number>();

  for (const je of jes) {
    const pid = paymentIdFromReference(je.reference);
    if (pid == null) continue;
    if (paymentById.has(pid) && !claimedPayments.has(pid)) {
      claimedPayments.add(pid);
      claimedJEs.add(je.id);
    }
  }

  for (const payment of payments) {
    if (claimedPayments.has(payment.id)) continue;

    const candidates = jes
      .filter((je) => {
        if (claimedJEs.has(je.id)) return false;
        // Do not use heuristic on unique Payment-/PAY- refs — those are handled above
        if (paymentIdFromReference(je.reference) != null) return false;
        if (Math.abs(Number(je.totalDebit) - Number(payment.amount)) > 0.009) {
          return false;
        }
        if (!sameCalendarDay(new Date(je.date), new Date(payment.date))) {
          return false;
        }
        const ref = (payment.reference ?? "").trim();
        if (ref && je.reference === ref) return true;
        const cat = (payment.category ?? "").trim();
        if (cat && (je.description ?? "").includes(cat)) return true;
        return false;
      })
      .sort((a, b) => {
        const ref = (payment.reference ?? "").trim();
        const aScore = ref && a.reference === ref ? 0 : 1;
        const bScore = ref && b.reference === ref ? 0 : 1;
        return aScore - bScore || a.id - b.id;
      });

    if (candidates[0]) {
      claimedPayments.add(payment.id);
      claimedJEs.add(candidates[0].id);
    }
  }

  // Only delete unclaimed JEs that used a non-unique shared reference
  // (never delete Payment-{id} here — safe cleanup already handled those)
  // Ensure we NEVER delete journal entries belonging to invoices, credit notes, debit notes, or shipments
  const orphanIds = jes
    .filter((je) => {
      if (claimedJEs.has(je.id)) return false;
      if (paymentIdFromReference(je.reference) != null) return false;
      const ref = (je.reference ?? "").trim();
      // Protect any reference that looks like an invoice number, credit note, debit note, or starting balance
      if (
        ref.startsWith("CREDIT-") ||
        ref.startsWith("DEBIT-") ||
        ref.startsWith("CN-") ||
        ref.startsWith("DN-") ||
        ref.startsWith("STARTING-BALANCE") ||
        ref.startsWith("JE-") ||
        /^\d+$/.test(ref)
      ) {
        return false;
      }
      return true;
    })
    .map((je) => je.id);

  removed += await deleteJournalEntriesByIds(orphanIds);
  return removed;
}

/** Find journal entries that belong to a specific payment (for delete). */
export async function findJournalEntriesForPayment(
  session: SessionPayload,
  payment: {
    id: number;
    reference: string | null;
    amount: number;
    date: Date;
    category: string | null;
    invoice: string | null;
  }
) {
  const paymentKey = `Payment-${payment.id}`;
  const payKey = `PAY-${payment.id}`;

  const byUniqueRef = await prisma.journalEntry.findMany({
    where: {
      organizationId: session.organizationId,
      OR: [
        { reference: paymentKey },
        { reference: payKey },
        { description: { contains: paymentKey } },
        { lines: { some: { reference: paymentKey } } },
        { lines: { some: { reference: payKey } } },
      ],
    },
    select: { id: true, entryNumber: true, reference: true },
  });

  if (byUniqueRef.length > 0) return byUniqueRef;

  // Legacy: shared bank reference (e.g. "Office") — match amount + date + payment-like desc
  const ref = (payment.reference ?? "").trim();
  if (!ref || ref === paymentKey || ref === payKey) return [];

  const candidates = await prisma.journalEntry.findMany({
    where: {
      organizationId: session.organizationId,
      reference: ref,
      OR: [
        { description: { startsWith: "Payment:" } },
        { description: { startsWith: "Invoice Payment:" } },
      ],
    },
    select: {
      id: true,
      entryNumber: true,
      reference: true,
      description: true,
      date: true,
      totalDebit: true,
    },
    orderBy: { id: "asc" },
  });

  const matched = candidates.filter((je) => {
    if (Math.abs(Number(je.totalDebit) - Number(payment.amount)) > 0.009) {
      return false;
    }
    if (!sameCalendarDay(new Date(je.date), new Date(payment.date))) {
      return false;
    }
    const cat = (payment.category ?? "").trim();
    if (cat && !(je.description ?? "").includes(cat)) return false;
    return true;
  });

  // Only take one — the oldest — so duplicate shared-ref JEs can be cleaned as orphans
  return matched.slice(0, 1).map(({ id, entryNumber, reference }) => ({
    id,
    entryNumber,
    reference,
  }));
}
