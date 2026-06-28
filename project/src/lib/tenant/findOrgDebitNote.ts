import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

/** Load debit note by id only if its vendor belongs to the session org. */
export async function findOrgDebitNote(
  session: SessionPayload,
  debitNoteId: number,
  include?: Parameters<typeof prisma.debitNote.findFirst>[0]["include"]
) {
  return prisma.debitNote.findFirst({
    where: {
      id: debitNoteId,
      vendor: { organizationId: session.organizationId },
    },
    include,
  });
}

/** Base filter for debit-note list queries. */
export function debitNoteOrgFilter(session: SessionPayload) {
  return { vendor: { organizationId: session.organizationId } };
}
