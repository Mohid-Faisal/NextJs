import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

/** Load credit note by id only if its customer belongs to the session org. */
export async function findOrgCreditNote(
  session: SessionPayload,
  creditNoteId: number,
  include?: Parameters<typeof prisma.creditNote.findFirst>[0]["include"]
) {
  return prisma.creditNote.findFirst({
    where: {
      id: creditNoteId,
      customer: { organizationId: session.organizationId },
    },
    include,
  });
}

/** Base filter for credit-note list queries. */
export function creditNoteOrgFilter(session: SessionPayload) {
  return { customer: { organizationId: session.organizationId } };
}
