import type { SessionPayload } from "@/lib/auth/session";
import { orgWhere } from "@/lib/tenant/prismaScope";

/** Next JE number scoped to one org. */
export async function nextJournalEntryNumber(
  prisma: { journalEntry: { findFirst: Function } },
  organizationId: number
): Promise<string> {
  const lastEntry = await prisma.journalEntry.findFirst({
    where: { organizationId },
    orderBy: { entryNumber: "desc" },
  });
  if (!lastEntry) return "JE-0001";
  const lastNumber = parseInt(String(lastEntry.entryNumber).split("-")[1], 10);
  return `JE-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, "0")}`;
}

export function chartWhere(session: SessionPayload, extra: Record<string, unknown> = {}) {
  return orgWhere(session, extra);
}

export function journalWhere(session: SessionPayload, extra: Record<string, unknown> = {}) {
  return orgWhere(session, extra);
}
