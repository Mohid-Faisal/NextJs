import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const DEMO_EMAIL = "demo@psswe.com";
const DEMO_PASSWORD = "DemoUser@123";
const DEMO_ORG_SLUG = "pss-demo";

/**
 * Guarantees that the unified Demo Account and Demo Organization exist in the database,
 * active, approved, and fully featured.
 */
export async function ensureDemoAccountExists() {
  try {
    // 1. Find or create the Demo Organization
    let org = await prisma.organization.findUnique({
      where: { slug: DEMO_ORG_SLUG },
      include: { subscription: true },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: "Demo Workspace (Shared)",
          slug: DEMO_ORG_SLUG,
          status: "active",
          currency: "PKR",
          invoicePrefix: "DEMO-",
          website: "https://proximasmart.com",
        },
        include: { subscription: true },
      });
    }

    // 2. Ensure default plan exists or fetch first available plan for subscription
    let plan = await prisma.plan.findFirst({
      where: { code: "enterprise" },
    });

    if (!plan) {
      plan = await prisma.plan.findFirst();
    }

    if (plan && !org.subscription) {
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });
    }

    // 3. Hash password and upsert Demo User
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      create: {
        name: "Demo User",
        email: DEMO_EMAIL,
        password: hashedPassword,
        role: "ADMIN",
        status: "ACTIVE",
        isApproved: true,
        platformRole: null,
      },
      update: {
        status: "ACTIVE",
        isApproved: true,
        // Update password hash if needed so DEMO_PASSWORD always works
        password: hashedPassword,
      },
    });

    // 4. Ensure Organization Member link exists
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        role: "OWNER",
      },
      update: {
        role: "OWNER",
      },
    });

    // 5. Check if user-added entries older than 24 hours exist, trigger reset
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldUserShipment = await prisma.shipment.findFirst({
      where: {
        organizationId: org.id,
        NOT: { trackingId: { startsWith: "DEMO-100" } },
        createdAt: { lt: oneDayAgo },
      },
    });

    if (oldUserShipment) {
      await resetDemoUserEntries();
    }

    return { user, org };
  } catch (error) {
    console.error("Error ensuring demo account exists:", error);
    throw error;
  }
}

/**
 * Deletes user-added temporary entries in the Demo Account if created > 24 hours ago,
 * while preserving all default sample demo entries permanently.
 */
export async function resetDemoUserEntries() {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: DEMO_ORG_SLUG },
    });

    if (!org) return;

    // Delete user-added shipments (keep default DEMO-1001, DEMO-1002, etc.)
    await prisma.shipment.deleteMany({
      where: {
        organizationId: org.id,
        NOT: {
          trackingId: { startsWith: "DEMO-100" },
        },
      },
    });

    // Delete user-added payments
    await prisma.payment.deleteMany({
      where: {
        organizationId: org.id,
        NOT: {
          OR: [
            { invoice: { startsWith: "DEMO-100" } },
            { reference: { startsWith: "DEMO-SEED" } },
          ],
        },
      },
    });

    // Delete user-added invoices
    await prisma.invoice.deleteMany({
      where: {
        organizationId: org.id,
        NOT: {
          invoiceNumber: { startsWith: "DEMO-100" },
        },
      },
    });

    // Delete user-added customers
    await prisma.customers.deleteMany({
      where: {
        organizationId: org.id,
        NOT: {
          CompanyName: "Apex Global Logistics Demo",
        },
      },
    });

    // Re-verify default sample customer exists
    await prisma.customers.upsert({
      where: {
        organizationId_CompanyName: {
          organizationId: org.id,
          CompanyName: "Apex Global Logistics Demo",
        },
      },
      create: {
        organizationId: org.id,
        CompanyName: "Apex Global Logistics Demo",
        PersonName: "John Doe",
        Email: "john@apexlogistics.demo",
        Phone: "+92 300 1234567",
        DocumentType: "NTN",
        DocumentNumber: "1234567-8",
        Country: "Pakistan",
        State: "Sindh",
        City: "Karachi",
        Zip: "75500",
        Address: "Suite 404, Business Plaza, I.I. Chundrigar Road",
        ActiveStatus: "Active",
        FilePath: "",
      },
      update: {},
    });

    // Re-verify default shipments exist
    const defaultShipments = [
      {
        trackingId: "DEMO-1001",
        invoiceNumber: "DEMO-1001",
        referenceNumber: "REF-88901",
        senderName: "Apex Global Logistics Demo",
        senderAddress: "Suite 404, Business Plaza, Karachi",
        recipientName: "TechCorp Middle East",
        recipientAddress: "Office 12, Tech Tower, Business Bay, Dubai, UAE",
        destination: "Dubai, United Arab Emirates",
        shippingMode: "Air Express",
        vendor: "Skynet Express",
        deliveryStatus: "In Transit",
        trackingStatus: "Out for Delivery",
        amount: 1,
        weight: 3.5,
        totalCost: 14500,
        subtotal: 14500,
        price: 14500,
        packageDescription: "Electronic Components & Circuit Samples",
      },
      {
        trackingId: "DEMO-1002",
        invoiceNumber: "DEMO-1002",
        referenceNumber: "REF-88902",
        senderName: "Apex Global Logistics Demo",
        senderAddress: "Suite 404, Business Plaza, Karachi",
        recipientName: "London Fashion Hub",
        recipientAddress: "45 Oxford Street, London, UK",
        destination: "London, United Kingdom",
        shippingMode: "Air Cargo",
        vendor: "DHL Express",
        deliveryStatus: "Delivered",
        trackingStatus: "Delivered to Recipient",
        amount: 3,
        weight: 12.0,
        totalCost: 38000,
        subtotal: 38000,
        price: 38000,
        packageDescription: "Textile & Garment Samples",
      },
    ];

    for (const ship of defaultShipments) {
      const existing = await prisma.shipment.findFirst({
        where: { organizationId: org.id, trackingId: ship.trackingId },
      });
      if (!existing) {
        await prisma.shipment.create({
          data: { ...ship, organizationId: org.id },
        });
      }
    }

    console.log("Demo account user entries reset successfully (defaults preserved).");
  } catch (error) {
    console.error("Error resetting demo account entries:", error);
  }
}
