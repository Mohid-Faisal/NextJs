/**
 * Copy all public table data from production → staging.
 *
 * Prerequisites:
 *   - Staging schema already exists (npx prisma db push)
 *   - .env points at STAGING (DATABASE_URL + DIRECT_URL)
 *
 * Usage:
 *   $env:PROD_DIRECT_URL="postgresql://postgres.mnmpptjhqtuskhgzjqqr:Mohid%402003@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
 *   npx tsx scripts/copy-prod-to-staging.ts
 *
 * Dry run (counts only):
 *   npx tsx scripts/copy-prod-to-staging.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";

const STAGING_REF = "vevbhriugutsaothxtcy";
const PROD_REF = "mnmpptjhqtuskhgzjqqr";
const BATCH = 500;

const TABLES = [
  "User",
  "Customers",
  "Vendors",
  "Recipients",
  "DeliveryTime",
  "Agency",
  "Office",
  "InvoiceStatus",
  "DeliveryStatus",
  "ShippingMode",
  "PackagingType",
  "ServiceMode",
  "Zone",
  "ZoneUpload",
  "RemoteArea",
  "Rate",
  "filename",
  "vendorservice",
  "FixedCharge",
  "AppSetting",
  "ChartOfAccount",
  "Shipment",
  "CustomerTransaction",
  "VendorTransaction",
  "Payment",
  "Invoice",
  "DebitNote",
  "CreditNote",
  "JournalEntry",
  "JournalEntryLine",
] as const;

function assertSafe() {
  const staging = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
  if (!staging.includes(STAGING_REF)) {
    throw new Error(
      `Refusing to run: .env must point at staging (${STAGING_REF}). Found: ${staging.slice(0, 60)}...`
    );
  }
  const prod = process.env.PROD_DIRECT_URL ?? "";
  if (!prod.includes(PROD_REF)) {
    throw new Error(
      `Set PROD_DIRECT_URL to production session pooler (must contain ${PROD_REF}).`
    );
  }
}

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function getColumns(prisma: PrismaClient, table: string) {
  const rows = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ${table}
    ORDER BY ordinal_position
  `;
  return rows.map((r) => r.column_name);
}

async function countRows(prisma: PrismaClient, table: string) {
  const [{ count }] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) AS count FROM \`${table}\``
  );
  return Number(count);
}

async function copyTable(
  prod: PrismaClient,
  staging: PrismaClient,
  table: string,
  dryRun: boolean
) {
  const prodCount = await countRows(prod, table);
  const stagingCount = await countRows(staging, table);
  console.log(`  ${table}: prod=${prodCount}, staging=${stagingCount}`);

  if (dryRun || prodCount === 0) return prodCount;

  if (stagingCount > 0) {
    await staging.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
  }

  const columns = await getColumns(prod, table);
  const colList = columns.map((c) => `\`${c}\``).join(", ");

  let offset = 0;
  let copied = 0;

  while (offset < prodCount) {
    const rows = await prod.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${colList} FROM \`${table}\` ORDER BY 1 LIMIT ${BATCH} OFFSET ${offset}`
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      const valueList = columns.map((col) => sqlLiteral(row[col])).join(", ");
      await staging.$executeRawUnsafe(
        `INSERT INTO \`${table}\` (${colList}) VALUES (${valueList})`
      );
    }

    copied += rows.length;
    offset += BATCH;
    process.stdout.write(`    copied ${copied}/${prodCount}\r`);
  }

  if (copied > 0) console.log(`    copied ${copied}/${prodCount}`.padEnd(40));
  return copied;
}

async function resetSequences(staging: PrismaClient) {
  // MySQL automatically updates the internal auto-increment value 
  // when explicit IDs are inserted, so no manual sequence resetting is required.
  console.log("  MySQL auto-increment sequences are handled automatically.");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  assertSafe();

  const prod = new PrismaClient({
    datasources: { db: { url: process.env.PROD_DIRECT_URL! } },
  });
  const staging = new PrismaClient();

  console.log(dryRun ? "DRY RUN — counts only\n" : "Copying production → staging\n");

  try {
    let total = 0;
    for (const table of TABLES) {
      total += await copyTable(prod, staging, table, dryRun);
    }

    if (!dryRun) {
      await staging.$executeRawUnsafe(`TRUNCATE TABLE "_prisma_migrations"`);
      console.log("\nCleared failed _prisma_migrations row on staging.");
      await resetSequences(staging);
      console.log("Reset ID sequences.");
    }

    console.log(`\nDone.${dryRun ? " Re-run without --dry-run to copy." : ""}`);
  } finally {
    await prod.$disconnect();
    await staging.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
