const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    where: {
      name: {
        contains: "Cure MD"
      }
    }
  });

  if (!org) {
    console.log("No test organization found");
    return;
  }

  console.log(`Found test org: ${org.name} (ID: ${org.id})`);
  const orgId = org.id;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Find all members of the organization
      const members = await tx.organizationMember.findMany({
        where: { organizationId: orgId },
        select: { userId: true },
      });
      const userIds = members.map((m) => m.userId);
      console.log("User IDs associated:", userIds);

      // 2. Delete invoice dependencies (debit and credit notes)
      const invoiceIds = (
        await tx.invoice.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        })
      ).map((inv) => inv.id);
      console.log("Invoice IDs:", invoiceIds);

      if (invoiceIds.length > 0) {
        const deletedDebits = await tx.debitNote.deleteMany({
          where: { billId: { in: invoiceIds } },
        });
        console.log("Deleted debit notes:", deletedDebits.count);
        const deletedCredits = await tx.creditNote.deleteMany({
          where: { invoiceId: { in: invoiceIds } },
        });
        console.log("Deleted credit notes:", deletedCredits.count);
      }

      // 3. Delete organization-specific records
      console.log("Deleting invoices...");
      await tx.invoice.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting payments...");
      await tx.payment.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting customer transactions...");
      await tx.customerTransaction.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting vendor transactions...");
      await tx.vendorTransaction.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting vendor services...");
      await tx.vendorservice.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting filenames...");
      await tx.filename.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting rates...");
      await tx.rate.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting remote areas...");
      await tx.remoteArea.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting zone uploads...");
      await tx.zoneUpload.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting zones...");
      await tx.zone.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting hscodes...");
      await tx.hsCode.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting service modes...");
      await tx.serviceMode.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting packaging types...");
      await tx.packagingType.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting shipping modes...");
      await tx.shippingMode.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting delivery status...");
      await tx.deliveryStatus.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting offices...");
      await tx.office.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting agencies...");
      await tx.agency.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting delivery times...");
      await tx.deliveryTime.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting shipments...");
      await tx.shipment.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting customers...");
      await tx.customers.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting vendors...");
      await tx.vendors.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting recipients...");
      await tx.recipients.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting fixed charges...");
      await tx.fixedCharge.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting chart of accounts...");
      await tx.chartOfAccount.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting journal entries...");
      await tx.journalEntry.deleteMany({ where: { organizationId: orgId } });
      console.log("Deleting payment proofs...");
      await tx.paymentProof.deleteMany({ where: { organizationId: orgId } });

      // 4. Delete memberships
      console.log("Deleting memberships...");
      await tx.organizationMember.deleteMany({ where: { organizationId: orgId } });

      // 5. Delete organization
      console.log("Deleting organization...");
      await tx.organization.delete({ where: { id: orgId } });

      // 6. Delete users if they have no other organization memberships left
      console.log("Deleting orphaned users...");
      for (const userId of userIds) {
        const otherMembershipsCount = await tx.organizationMember.count({
          where: { userId },
        });
        if (otherMembershipsCount === 0) {
          await tx.user.delete({ where: { id: userId } });
        }
      }
      
      console.log("Transaction check complete. Rolling back test deletion...");
      throw new Error("ROLLBACK_FOR_TEST");
    }, {
      timeout: 30000 // 30 seconds timeout
    });
  } catch (error) {
    if (error.message === "ROLLBACK_FOR_TEST") {
      console.log("SUCCESS: Deletion transaction works without database errors!");
    } else {
      console.error("FAILURE: Prisma error during deletion:", error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
