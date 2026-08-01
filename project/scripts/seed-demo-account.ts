import { PrismaClient } from "@prisma/client";
import { ensureDemoAccountExists, DEMO_EMAIL, DEMO_PASSWORD } from "../src/lib/auth/demoAccount";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Demo Account and Organization...");
  const { user, org } = await ensureDemoAccountExists();

  console.log(`Demo Organization: ${org.name} (ID: ${org.id}, Slug: ${org.slug})`);
  console.log(`Demo User: ${user.name} (${user.email})`);

  // Check existing shipments in demo org
  const shipmentCount = await prisma.shipment.count({
    where: { organizationId: org.id },
  });

  if (shipmentCount === 0) {
    console.log("Creating initial sample shipments for Demo Organization...");

    // Create a sample customer
    const sampleCustomer = await prisma.customers.upsert({
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

    // Create sample shipments
    const sampleShipments = [
      {
        organizationId: org.id,
        trackingId: "DEMO-1001",
        invoiceNumber: "INV-DEMO-1001",
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
        organizationId: org.id,
        trackingId: "DEMO-1002",
        invoiceNumber: "INV-DEMO-1002",
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

    for (const ship of sampleShipments) {
      await prisma.shipment.create({
        data: ship,
      });
    }

    console.log("Sample demo shipments created successfully.");
  } else {
    console.log(`Demo org already has ${shipmentCount} existing shipments.`);
  }

  console.log("\n===========================================");
  console.log("DEMO ACCOUNT IS READY:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Org:      ${org.name} (${org.slug})`);
  console.log("===========================================\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
