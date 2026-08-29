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
 * Reinforced cleanup after a payment delete.
 * Strictly deletes only JEs with exact Payment-{id} / PAY-{id} references
 * where the payment has been deleted. Never uses heuristics or description matching.
 */
export async function cleanupOrphanPaymentJournalEntriesAfterDelete(
  session: SessionPayload
): Promise<number> {
  return await cleanupOrphanPaymentJournalEntries(session);
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

  return byUniqueRef;
}
