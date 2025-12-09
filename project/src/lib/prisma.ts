// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const baseUrl = process.env.DATABASE_URL;
// Mitigate Postgres prepared-statement cache issues (e.g., "prepared statement ... does not exist")
const datasourceUrl =
  baseUrl && baseUrl.includes('?')
    ? `${baseUrl}&statement_cache_size=0`
    : baseUrl
      ? `${baseUrl}?statement_cache_size=0`
      : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
