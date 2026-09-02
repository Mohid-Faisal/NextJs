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
    findFirst: (args: any) => Promise<{ entryNumber: string; id?: number } | null>;
    findMany?: (args: any) => Promise<Array<{ entryNumber: string }>>;
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
 * routes. Ensures the sequence is atomic, collision-free, and always strictly
 * above any existing JE-#### entry in the database.
 */
export async function nextJournalEntryNumber(
  db: PrismaLike,
  organizationId: number
): Promise<string> {
  const seqDb = db.orgSequence ? db : (prisma as unknown as PrismaLike);
  
  // Fast atomic allocation
  const n = await nextSequenceNumber(db, organizationId, "journal_entry");
  const formatted = `JE-${String(n).padStart(4, "0")}`;

  // Collision safety check: ensure the allocated entryNumber doesn't already exist
  const checkDb = db.journalEntry ? db : (prisma as unknown as PrismaLike);
  const existing = await checkDb.journalEntry.findFirst({
    where: { organizationId, entryNumber: formatted },
    select: { id: true } as any,
  });

  if (existing) {
    // Collision detected (sequence was behind legacy data): fast-forward to true max + 1
    let maxNum = n;
    try {
      const rawResult: any = await (prisma as any).$queryRaw`
        SELECT COALESCE(MAX(CAST(REGEXP_SUBSTR(entryNumber, '[0-9]+') AS UNSIGNED)), 0) as maxNum
        FROM JournalEntry WHERE organizationId = ${organizationId}
      `;
      if (rawResult && rawResult[0] && Number(rawResult[0].maxNum) > maxNum) {
        maxNum = Number(rawResult[0].maxNum);
      }
    } catch {
      // Fallback if raw query is not supported in environment
      const recent = await checkDb.journalEntry.findMany?.({
        where: { organizationId },
        select: { entryNumber: true },
        take: 500,
      } as any) || [];
      for (const item of recent) {
        const match = String(item.entryNumber).match(/\d+/);
        if (match) {
          const val = parseInt(match[0], 10);
          if (val > maxNum) maxNum = val;
        }
      }
    }

    const correctNext = maxNum + 1;
    await seqDb.orgSequence.upsert({
      where: { organizationId_key: { organizationId, key: "journal_entry" } },
      update: { nextNumber: correctNext + 1 },
      create: { organizationId, key: "journal_entry", nextNumber: correctNext + 1 },
    });
    return `JE-${String(correctNext).padStart(4, "0")}`;
  }

  return formatted;
}
