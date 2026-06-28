import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { orgWhere } from "@/lib/tenant/prismaScope";

/** Load payment by id only if it belongs to the session org. */
export async function findOrgPayment(session: SessionPayload, paymentId: number) {
  return prisma.payment.findFirst({
    where: orgWhere(session, { id: paymentId }),
  });
}

/** Load invoice by invoiceNumber within the session org. */
export async function findOrgInvoiceByNumber(
  session: SessionPayload,
  invoiceNumber: string
) {
  return prisma.invoice.findFirst({
    where: orgWhere(session, { invoiceNumber }),
    include: { customer: true, vendor: true },
  });
}
