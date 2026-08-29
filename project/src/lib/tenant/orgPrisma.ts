import { prisma } from "@/lib/prisma";

/**
 * Tenant-isolating Prisma client.
 *
 * SECURITY (#1 improvement): every query through this client is FORCED onto
 * one organization — `where` clauses gain an `organizationId` filter and
 * creates are stamped automatically. A developer can no longer forget
 * `orgWhere()` and leak cross-tenant rows; the only way past isolation is an
 * explicit, reviewable escape hatch.
 *
 * Scope notes / limitations (documented deliberately):
 *  - Covers the models that carry an `organizationId` column (TENANT_MODELS).
 *  - Actions covered: findMany, findFirst, count, aggregate, groupBy,
 *    update, updateMany, delete, deleteMany, create, createMany.
 *  - `findUnique` is NOT intercepted (its arg must be a unique key) — use
 *    `findFirst` through this client for scoped reads.
 *  - Nested relation operations inside a single call (e.g.
 *    `journalEntry.create({ data: { lines: { create: [...] } } })`) are not
 *    rewritten — stamp those rows explicitly (already the pattern in this
 *    codebase).
 */

const TENANT_MODELS = new Set<string>([
  "shipment",
  "customers",
  "vendors",
  "recipients",
  "deliveryTime",
  "agency",
  "office",
  "deliveryStatus",
  "shippingMode",
  "packagingType",
  "serviceMode",
  "hsCode",
  "zone",
  "zoneUpload",
  "remoteArea",
  "rate",
  "filename",
  "customerTransaction",
  "vendorTransaction",
  "vendorservice",
  "payment",
  "invoice",
  "chartOfAccount",
  "journalEntry",
  "journalEntryLine",
  "debitNote",
  "creditNote",
  "fixedCharge",
  "paymentProof",
]);

const READ_ACTIONS = new Set(["findMany", "findFirst", "count", "aggregate", "groupBy"]);
const WRITE_ACTIONS = new Set(["update", "updateMany", "delete", "deleteMany"]);
const CREATE_ACTIONS = new Set(["create", "createMany"]);

export function orgPrisma(organizationId: number) {
  return prisma.$extends({
    name: "orgScope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelName = (model ?? "").toString();
          const lower = modelName.charAt(0).toLowerCase() + modelName.slice(1);

          if (!TENANT_MODELS.has(lower)) {
            return query(args as never);
          }

          const typedArgs = (args ?? {}) as Record<string, any>;

          if (READ_ACTIONS.has(operation) || WRITE_ACTIONS.has(operation)) {
            // FORCE the tenant filter even if the caller passed their own
            // where — merging via AND means user conditions still apply but
            // cannot widen scope across tenants.
            typedArgs.where = {
              AND: [{ organizationId }, typedArgs.where ?? {}].filter(Boolean),
            };
          } else if (CREATE_ACTIONS.has(operation)) {
            if (operation === "create") {
              typedArgs.data = { ...typedArgs.data, organizationId };
            } else {
              // createMany: data may be object or array
              const data = typedArgs.data;
              typedArgs.data = Array.isArray(data)
                ? data.map((d) => ({ ...d, organizationId }))
                : { ...data, organizationId };
            }
          }

          return query(typedArgs as never);
        },
      },
    },
  });
}

export type OrgPrisma = ReturnType<typeof orgPrisma>;
