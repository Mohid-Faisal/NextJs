/**
 * Create a test admin user on staging linked to pss-default org.
 *   npx tsx scripts/seed-test-user.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_EMAIL = "admin@pss.test";
const TEST_PASSWORD = "Test@1234";

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: "pss-default" } });
  if (!org) throw new Error("Run migrate-to-default-org.ts first");

  const hash = await bcrypt.hash(TEST_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    create: {
      name: "PSS Admin",
      email: TEST_EMAIL,
      password: hash,
      role: "ADMIN",
      status: "ACTIVE",
      isApproved: true,
      platformRole: "SUPER_ADMIN",
    },
    update: {
      password: hash,
      status: "ACTIVE",
      isApproved: true,
      platformRole: "SUPER_ADMIN",
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: user.id },
    },
    create: { organizationId: org.id, userId: user.id, role: "OWNER" },
    update: { role: "OWNER" },
  });

  console.log("Test user ready:");
  console.log(`  Email:    ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
  console.log(`  Org:      ${org.name} (${org.slug})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
