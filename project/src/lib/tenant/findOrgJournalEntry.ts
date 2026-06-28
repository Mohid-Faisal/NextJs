import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { orgWhere } from "@/lib/tenant/prismaScope";

/** Load journal entry by id only if it belongs to the session org. */
export async function findOrgJournalEntry(
  session: SessionPayload,
  entryId: number,
  include?: Parameters<typeof prisma.journalEntry.findFirst>[0]["include"]
) {
  return prisma.journalEntry.findFirst({
    where: orgWhere(session, { id: entryId }),
    include,
  });
}
