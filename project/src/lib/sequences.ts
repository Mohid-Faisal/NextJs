import { prisma } from "@/lib/prisma";

/**
 * Atomic per-organization document counters (#3 improvement).
 *
 * Replaces MAX(id)+1 scans that race under concurrency and produce duplicate
 * document numbers. Uses an UPDATE with an increment (a single atomic row
 * write in MySQL) inside the caller's transaction where possible.
 *
 * The `OrgSequence` table must be seeded above current maxima — see
 * prisma/manual-migrations/2026-08-23-audit-log-and-sequences.sql.
 */

type PrismaLike = {
  orgSequence: {
    upsert: (args: any) => Promise<{ nextNumber: number }>;
    findUnique: (args: any) => Promise<{ nextNumber: number } | null>;
    create: (args: any) => Promise<{ nextNumber: number }>;
  };
  journalEntry: {
    findFirst: (args: any) => Promise<{ entryNumber: string } | null>;
  };
};

/**
 * Reserve the next number for `key` within `organizationId`.
 * Pass a transaction client (`tx`) when the reservation must commit or roll
 * back atomically with the document being numbered.
 */
export async function nextSequenceNumber(
  db: PrismaLike,
  organizationId: number,
  key: string
): Promise<number> {
  // Atomic increment-or-init: the upsert's update path is a single statement,
  // so two concurrent callers always receive distinct numbers.
  const row = await db.orgSequence.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: { nextNumber: { increment: 1 } },
    create: { organizationId, key, nextNumber: 2 },
  });
  // The value returned by `update` is post-increment; on create we seeded 2
  // so both paths hand out a distinct, monotonically increasing number.
  return row.nextNumber - 1;
}

/** JE-#### formatted, scoped per organization. */
export async function nextJournalEntryNumberAtomic(
  db: PrismaLike,
  organizationId: number
): Promise<string> {
  const n = await nextSequenceNumber(db, organizationId, "journal_entry");
  return `JE-${String(n).padStart(4, "0")}`;
}

/**
 * Backwards-compatible wrapper matching the previous signature used across
 * routes. Ensures the sequence starts above any legacy JE-#### entry.
 */
export async function nextJournalEntryNumber(
  db: PrismaLike,
  organizationId: number
): Promise<string> {
  const seqDb = db.orgSequence ? db : (prisma as unknown as PrismaLike);
  const existing = await seqDb.orgSequence.findUnique({
    where: { organizationId_key: { organizationId, key: "journal_entry" } },
    select: { nextNumber: true },
  });

  if (!existing) {
    // First use after migration: seed from the legacy maximum.
    const lastEntry = await db.journalEntry.findFirst({
      where: { organizationId },
      orderBy: { entryNumber: "desc" },
    });
    let seed = 1;
    if (lastEntry) {
      const parsed = parseInt(String(lastEntry.entryNumber).split("-")[1], 10);
      seed = Number.isFinite(parsed) ? parsed + 1 : 1;
    }
    try {
      await seqDb.orgSequence.create({
        data: { organizationId, key: "journal_entry", nextNumber: seed + 1 },
      });
      return `JE-${String(seed).padStart(4, "0")}`;
    } catch {
      // Lost a race to seed — fall through and take the next increment.
    }
  }

  return nextJournalEntryNumberAtomic(db, organizationId);
}
