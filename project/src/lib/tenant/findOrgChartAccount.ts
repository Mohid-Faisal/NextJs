import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { orgWhere } from "@/lib/tenant/prismaScope";

/** Load chart-of-account row by id only if it belongs to the session org. */
export async function findOrgChartAccount(
  session: SessionPayload,
  accountId: number
) {
  return prisma.chartOfAccount.findFirst({
    where: orgWhere(session, { id: accountId }),
  });
}

/** Load chart-of-account row by filter within the session org. */
export async function findOrgChartAccountByFilter(
  session: SessionPayload,
  extra: Record<string, unknown> = {}
) {
  return prisma.chartOfAccount.findFirst({
    where: orgWhere(session, extra),
  });
}

/** Load chart-of-account row by code within the session org. */
export async function findOrgChartAccountByCode(
  session: SessionPayload,
  code: string
) {
  return prisma.chartOfAccount.findFirst({
    where: orgWhere(session, { code }),
  });
}
