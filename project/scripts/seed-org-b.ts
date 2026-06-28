/**
 * Create org B + test user for tenant isolation checks.
 *   npx tsx scripts/seed-org-b.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "admin@orgb.test";
const PASSWORD = "Test@1234";

async function main() {
  const starter = await prisma.plan.findUnique({ where: { code: "starter" } });
  if (!starter) throw new Error("Run migrate-to-default-org.ts first");

  const org = await prisma.organization.upsert({
    where: { slug: "test-org-b" },
    create: {
      name: "Test Org B",
      slug: "test-org-b",
      status: "trial",
      subscription: {
        create: {
          planId: starter.id,
          status: "trialing",
        },
      },
    },
    update: { name: "Test Org B", status: "trial" },
  });

  const hash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      name: "Org B Admin",
      email: EMAIL,
      password: hash,
      role: "ADMIN",
      status: "ACTIVE",
      isApproved: true,
    },
    update: {
      password: hash,
      status: "ACTIVE",
      isApproved: true,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: user.id },
    },
    create: { organizationId: org.id, userId: user.id, role: "OWNER" },
    update: { role: "OWNER" },
  });

  // One shipment in org B only
  const existing = await prisma.shipment.findFirst({
    where: { organizationId: org.id, trackingId: "ORGB-TEST-001" },
  });
  if (!existing) {
    await prisma.shipment.create({
      data: {
        organizationId: org.id,
        trackingId: "ORGB-TEST-001",
        referenceNumber: "ORGB-REF-001",
        senderName: "Org B Sender",
        senderAddress: "Test",
        recipientName: "Org B Recipient",
        recipientAddress: "Test",
        destination: "US",
        totalCost: 100,
      },
    });
  }

  console.log("Org B ready:");
  console.log(`  Org id:   ${org.id} (${org.slug})`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Shipment: ORGB-TEST-001 (org ${org.id} only)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
