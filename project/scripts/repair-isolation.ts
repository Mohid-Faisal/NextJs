/**
 * Repair tenant isolation after bad migration.
 *
 * Problem: migrate-to-default-org.ts was run AFTER seed-org-b.ts, which:
 *   1. Linked admin@orgb.test to org 1 (wrong — they belong to org 2 only)
 *   2. Reassigned ORGB-TEST-001 shipment to org 1 (wrong — org 2's data)
 *
 * This script:
 *   1. Removes admin@orgb.test's membership in org 1 (if any)
 *   2. Reassigns ORGB-TEST-001 back to org 2
 *
 * Idempotent — safe to re-run.
 *
 * Usage:  npx tsx scripts/repair-isolation.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== repair-isolation ===\n");

  // Find org B
  const orgB = await prisma.organization.findUnique({
    where: { slug: "test-org-b" },
  });
  if (!orgB) {
    console.log("Org B (test-org-b) not found — nothing to repair.");
    return;
  }

  const orgDefault = await prisma.organization.findUnique({
    where: { slug: "pss-default" },
  });
  if (!orgDefault) {
    console.log("Default org (pss-default) not found — nothing to repair.");
    return;
  }

  // Find the Org B admin user
  const orgBUser = await prisma.user.findUnique({
    where: { email: "admin@orgb.test" },
  });
  if (!orgBUser) {
    console.log("admin@orgb.test not found — nothing to repair.");
    return;
  }

  // 1. Remove incorrect membership in org 1 (if exists)
  const wrongMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgDefault.id,
        userId: orgBUser.id,
      },
    },
  });

  if (wrongMembership) {
    await prisma.organizationMember.delete({
      where: { id: wrongMembership.id },
    });
    console.log(
      `✓ Removed incorrect membership: admin@orgb.test was in org ${orgDefault.id} (pss-default)`
    );
  } else {
    console.log(
      `✓ admin@orgb.test is NOT in org ${orgDefault.id} — already clean`
    );
  }

  // Verify correct membership exists
  const correctMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgB.id,
        userId: orgBUser.id,
      },
    },
  });
  if (correctMembership) {
    console.log(
      `✓ admin@orgb.test is correctly in org ${orgB.id} (test-org-b) as ${correctMembership.role}`
    );
  } else {
    console.log(`✗ admin@orgb.test has NO membership in org ${orgB.id} — re-creating...`);
    await prisma.organizationMember.create({
      data: {
        organizationId: orgB.id,
        userId: orgBUser.id,
        role: "OWNER",
      },
    });
    console.log(`✓ Re-created membership for admin@orgb.test in org ${orgB.id}`);
  }

  // 2. Reassign ORGB-TEST-001 shipment back to org B
  // Find shipments with ORGB-TEST-001 tracking ID in any org
  const markers = await prisma.shipment.findMany({
    where: { trackingId: "ORGB-TEST-001" },
    select: { id: true, organizationId: true, trackingId: true },
  });

  if (markers.length === 0) {
    console.log("\nORGB-TEST-001 shipment not found — re-seeding...");
    await prisma.shipment.create({
      data: {
        organizationId: orgB.id,
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
    console.log(`✓ Created ORGB-TEST-001 in org ${orgB.id}`);
  } else {
    // Check if org B already has a correct copy
    const correctCopy = markers.find((s) => s.organizationId === orgB.id);
    const wrongCopies = markers.filter((s) => s.organizationId !== orgB.id);

    if (correctCopy) {
      console.log(
        `✓ Shipment #${correctCopy.id} (ORGB-TEST-001) already in org ${orgB.id} — correct`
      );
    }

    for (const s of wrongCopies) {
      if (correctCopy) {
        // Org B already has the shipment — delete the wrong copy
        await prisma.shipment.delete({ where: { id: s.id } });
        console.log(
          `✓ Deleted duplicate shipment #${s.id} (ORGB-TEST-001) from org ${s.organizationId}`
        );
      } else {
        // No copy in org B — move this one
        await prisma.shipment.update({
          where: { id: s.id },
          data: { organizationId: orgB.id },
        });
        console.log(
          `✓ Moved shipment #${s.id} (ORGB-TEST-001) from org ${s.organizationId} → org ${orgB.id}`
        );
      }
    }

    if (!correctCopy && wrongCopies.length === 0) {
      console.log(`✓ No wrong copies found — data is clean`);
    }
  }

  // Summary: show all memberships for this user
  const allMemberships = await prisma.organizationMember.findMany({
    where: { userId: orgBUser.id },
    include: { organization: { select: { name: true, slug: true } } },
  });
  console.log(`\nFinal memberships for admin@orgb.test:`);
  for (const m of allMemberships) {
    console.log(`  org ${m.organizationId} (${m.organization.slug}) — role: ${m.role}`);
  }

  // Show shipment counts per org
  const orgAShipments = await prisma.shipment.count({ where: { organizationId: orgDefault.id } });
  const orgBShipments = await prisma.shipment.count({ where: { organizationId: orgB.id } });
  console.log(`\nShipment counts:`);
  console.log(`  Org 1 (pss-default): ${orgAShipments}`);
  console.log(`  Org 2 (test-org-b):  ${orgBShipments}`);

  console.log("\n✓ Repair complete. Re-run test-isolation-week3.ts to verify.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
