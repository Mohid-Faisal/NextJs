import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { orgWhere } from "@/lib/tenant/prismaScope";

/** Load invoice by id only if it belongs to the session org. */
export async function findOrgInvoice(
  session: SessionPayload,
  invoiceId: number,
  extra: Record<string, unknown> = {},
  include?: any
) {
  return prisma.invoice.findFirst({
    where: orgWhere(session, { id: invoiceId, ...extra }),
    include,
  });
}
