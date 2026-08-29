import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const baseUrl = process.env.DATABASE_URL;
const datasourceUrl =
  baseUrl && baseUrl.includes("?")
    ? `${baseUrl}&statement_cache_size=0`
    : baseUrl
      ? `${baseUrl}?statement_cache_size=0`
      : undefined;

function hydrateDecimals(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Decimal) return value.toNumber();
  if (value instanceof Date) return value;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(hydrateDecimals);
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = hydrateDecimals(v);
    }
    return out;
  }
  return value;
}

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
  });

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const result = await query(args);
        return hydrateDecimals(result);
      },
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}
