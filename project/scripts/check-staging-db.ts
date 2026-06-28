const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    console.log("Tables:", tables.map((t) => t.tablename).join(", ") || "(none)");

    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at, logs
      FROM "_prisma_migrations"
      ORDER BY started_at
    `;
    console.log("\n_prisma_migrations:", JSON.stringify(migrations, null, 2));

    try {
      const [{ count }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Shipment"`;
      console.log("\nShipment count:", count);
    } catch (e) {
      console.log("\nShipment table:", e.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
