import { describe, expect, test } from "vitest";
import { nextSequenceNumber } from "@/lib/sequences";

/** Mock Prisma-like client: OrgSequence.upsert with atomic increment semantics. */
function mockDb(seed: Map<string, number>) {
  return {
    orgSequence: {
      upsert: async ({ where, update }: any) => {
        const key = `${where.organizationId_key.organizationId}:${where.organizationId_key.key}`;
        const current = seed.get(key) ?? 0;
        if (current === 0) {
          // create path — seeded value is `create.nextNumber - 1` handed out
          const created = update ? 1 : 1;
          seed.set(key, created + 1);
          return { nextNumber: created + 1 };
        }
        // Simulate the atomic increment: read-modify-write as one step
        const next = current + (update.nextNumber.increment ?? 1);
        seed.set(key, next);
        return { nextNumber: next };
      },
    },
    journalEntry: {
      findFirst: async () => null,
    },
  };
}

describe("nextSequenceNumber", () => {
  test("hands out monotonically increasing numbers", async () => {
    const store = new Map<string, number>();
    const db = mockDb(store);
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      seen.push(await nextSequenceNumber(db as never, 5, "journal_entry"));
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("concurrent reservations never collide", async () => {
    const store = new Map<string, number>();
    const db = mockDb(store);
    // Fire 25 reservations concurrently; all results must be unique.
    // (The real implementation relies on a DB-side atomic increment —
    // this mock serializes through the event loop to model that.)
    const results = await Promise.all(
      Array.from({ length: 25 }, () => nextSequenceNumber(db as never, 7, "invoice_number"))
    );
    expect(new Set(results).size).toBe(25);
  });

  test("sequences are isolated per organization", async () => {
    const store = new Map<string, number>();
    const db = mockDb(store);
    const a1 = await nextSequenceNumber(db as never, 1, "je");
    const b1 = await nextSequenceNumber(db as never, 2, "je");
    const a2 = await nextSequenceNumber(db as never, 1, "je");
    expect(a2).toBe(a1 + 1);
    expect(b1).toBe(1);
  });
});
