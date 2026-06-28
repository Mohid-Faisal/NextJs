/**
 * Day 1 SaaS: seed plans, default org, backfill organizationId, link users.
 *
 * Run on staging (or prod during cutover):
 *   npx tsx scripts/migrate-to-default-org.ts
 *
 * Idempotent — safe to re-run.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLANS = [
  {
    code: "starter",
    name: "Starter",
    priceMonthlyUsd: 49,
    maxUsers: 2,
    maxShipmentsPerMonth: 500,
    features: { accounts: false, bulkUpload: true },
  },
  {
    code: "business",
    name: "Business",
    priceMonthlyUsd: 99,
    maxUsers: 5,
    maxShipmentsPerMonth: 2000,
    features: { accounts: true, bulkUpload: true },
  },
  {
    code: "pro",
    name: "Pro",
    priceMonthlyUsd: 199,
    maxUsers: 15,
    maxShipmentsPerMonth: 10000,
    features: { accounts: true, bulkUpload: true },
  },
] as const;

const TIER1_TABLES = [
  "Shipment",
  "Customers",
  "Vendors",
  "Recipients",
  "Invoice",
  "Payment",
  "CustomerTransaction",
  "VendorTransaction",
] as const;

async function seedPlans() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: plan,
      update: {
        name: plan.name,
        priceMonthlyUsd: plan.priceMonthlyUsd,
        maxUsers: plan.maxUsers,
        maxShipmentsPerMonth: plan.maxShipmentsPerMonth,
        features: plan.features,
      },
    });
  }
  console.log("Plans seeded:", PLANS.map((p) => p.code).join(", "));
}

async function getOrCreateDefaultOrg() {
  const existing = await prisma.organization.findUnique({
    where: { slug: "pss-default" },
  });
  if (existing) {
    console.log("Organization already exists:", existing.id, existing.name);
    return existing;
  }

  const org = await prisma.organization.create({
    data: {
      name: "PSS Default",
      slug: "pss-default",
      status: "active",
      currency: "PKR",
    },
  });
  console.log("Created organization:", org.id, org.name);
  return org;
}

async function backfillOrganizationId(orgId: number) {
  for (const table of TIER1_TABLES) {
    // Only backfill rows that have no org yet (NULL) or still carry the
    // default seed value (1) when the default org *is* org 1.  Never
    // re-assign rows that already belong to another org.
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "organizationId" = $1 WHERE "organizationId" IS NULL`,
      orgId
    );
    const [{ count }] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" = $1`,
      orgId
    );
    console.log(`  ${table}: ${Number(count)} rows → org ${orgId} (updated ${result} this run)`);
  }
}

async function linkUsersAsOwners(orgId: number) {
  // Only link users who have NO membership yet.  Users who already belong
  // to another org (e.g. seeded Org B admin) must not be pulled into the
  // default org — that would break tenant isolation.
  const users = await prisma.user.findMany({
    where: {
      memberships: { none: {} },
    },
    select: { id: true, email: true },
  });
  let linked = 0;

  for (const user of users) {
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: orgId, userId: user.id },
      },
      create: {
        organizationId: orgId,
        userId: user.id,
        role: "OWNER",
      },
      update: { role: "OWNER" },
    });
    linked++;
  }

  console.log(`Linked ${linked} user(s) as OWNER of org ${orgId} (skipped users already in an org)`);
}

async function ensureSubscription(orgId: number) {
  const businessPlan = await prisma.plan.findUnique({ where: { code: "business" } });
  if (!businessPlan) throw new Error("Business plan not found — run seedPlans first");

  await prisma.subscription.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      planId: businessPlan.id,
      status: "active",
    },
    update: {
      planId: businessPlan.id,
      status: "active",
    },
  });
  console.log("Subscription: business / active for org", orgId);
}

async function printCounts(orgId: number) {
  const [shipments, invoices, users, members] = await Promise.all([
    prisma.shipment.count({ where: { organizationId: orgId } }),
    prisma.invoice.count({ where: { organizationId: orgId } }),
    prisma.user.count(),
    prisma.organizationMember.count({ where: { organizationId: orgId } }),
  ]);
  console.log("\nSummary:");
  console.log(`  Shipments: ${shipments}`);
  console.log(`  Invoices:  ${invoices}`);
  console.log(`  Users:     ${users}`);
  console.log(`  Members:   ${members}`);
}

async function main() {
  console.log("=== migrate-to-default-org ===\n");

  await seedPlans();
  const org = await getOrCreateDefaultOrg();

  console.log("\nBackfilling organizationId...");
  await backfillOrganizationId(org.id);

  console.log("\nLinking users...");
  await linkUsersAsOwners(org.id);

  console.log("\nSubscription...");
  await ensureSubscription(org.id);

  await printCounts(org.id);
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
