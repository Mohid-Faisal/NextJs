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

    console.log(`[resetDemoUserEntries] Cleaning demo organization ID ${org.id}...`);

    // Delete user-added shipments (keep default DEMO-1001 through DEMO-1015)
    const delShip = await prisma.shipment.deleteMany({
      where: {
        organizationId: org.id,
        NOT: {
          trackingId: { startsWith: "DEMO-10" },
        },
      },
    });
    console.log(`Deleted ${delShip.count} user-added shipments.`);

    // Delete user-added payments
    const delPay = await prisma.payment.deleteMany({
      where: {
        organizationId: org.id,
        NOT: {
          OR: [
            { invoice: { startsWith: "DEMO-10" } },
            { reference: { startsWith: "DEMO-SEED" } },
          ],
        },
      },
    });
    console.log(`Deleted ${delPay.count} user-added payments.`);

    // Delete user-added invoices
    const delInv = await prisma.invoice.deleteMany({
      where: {
        organizationId: org.id,
        NOT: {
          invoiceNumber: { startsWith: "DEMO-10" },
        },
      },
    });
    console.log(`Deleted ${delInv.count} user-added invoices.`);

    // Re-verify default sample customers exist (12)
    const defaultCustomers = [
      { CompanyName: "Apex Global Logistics Demo", PersonName: "John Doe", Email: "john@apexlogistics.demo", Phone: "+92 300 1234567", Country: "Pakistan", City: "Karachi", Address: "Suite 404, Business Plaza, Karachi" },
      { CompanyName: "TechCorp Middle East FZE", PersonName: "Ahmed Al-Mansoor", Email: "ahmed@techcorp.ae", Phone: "+971 4 800 9000", Country: "United Arab Emirates", City: "Dubai", Address: "Office 12, Tech Tower, Business Bay, Dubai" },
      { CompanyName: "London Fashion Hub Ltd", PersonName: "Sarah Jenkins", Email: "sarah@londonfashion.uk", Phone: "+44 20 7946 0912", Country: "United Kingdom", City: "London", Address: "45 Oxford Street, London" },
      { CompanyName: "Gulf Electronics Trading", PersonName: "Tariq Al-Zahrani", Email: "tariq@gulfelectronics.sa", Phone: "+966 11 400 3322", Country: "Saudi Arabia", City: "Riyadh", Address: "Olaya Street, Riyadh" },
      { CompanyName: "Crescent Textile Mills", PersonName: "Muhammad Bilal", Email: "bilal@crescenttextile.pk", Phone: "+92 41 855 1100", Country: "Pakistan", City: "Faisalabad", Address: "Sheikhupura Road, Faisalabad" },
      { CompanyName: "Silk Road Import & Export", PersonName: "Emre Yilmaz", Email: "emre@silkroad.tr", Phone: "+90 212 500 4433", Country: "Turkey", City: "Istanbul", Address: "Levent Business District, Istanbul" },
      { CompanyName: "EuroTech Industrial Supplies", PersonName: "Karl Mueller", Email: "karl@eurotech.de", Phone: "+49 69 900 1122", Country: "Germany", City: "Frankfurt", Address: "Kaiserstrasse 88, Frankfurt" },
      { CompanyName: "Pacific International Freight", PersonName: "Chen Wei", Email: "chen@pacificfreight.sg", Phone: "+65 6700 8899", Country: "Singapore", City: "Singapore", Address: "Marina Bay Financial Centre, Singapore" },
      { CompanyName: "Atlas Trading Solutions", PersonName: "David Miller", Email: "david@atlastrading.ca", Phone: "+1 416 555 0199", Country: "Canada", City: "Toronto", Address: "100 Bay Street, Toronto" },
      { CompanyName: "Horizon Garment Exports", PersonName: "Zubair Hashmi", Email: "zubair@horizongarments.pk", Phone: "+92 42 357 8899", Country: "Pakistan", City: "Lahore", Address: "Gulberg III, Lahore" },
      { CompanyName: "Tokyo Medical Devices", PersonName: "Kenji Sato", Email: "sato@tokyomedical.jp", Phone: "+81 3 5555 1234", Country: "Japan", City: "Tokyo", Address: "Chiyoda-ku, Tokyo" },
      { CompanyName: "North America Cargo Corp", PersonName: "Robert Davis", Email: "robert@nacargo.us", Phone: "+1 212 555 0144", Country: "United States", City: "New York", Address: "5th Avenue, New York" },
    ];

    const delCust = await prisma.customers.deleteMany({
      where: {
        organizationId: org.id,
        NOT: {
          CompanyName: { in: defaultCustomers.map((c) => c.CompanyName) },
        },
      },
    });
    console.log(`Deleted ${delCust.count} user-added customers.`);

    for (const cust of defaultCustomers) {
      try {
        await prisma.customers.upsert({
          where: {
            organizationId_CompanyName: {
              organizationId: org.id,
              CompanyName: cust.CompanyName,
            },
          },
          create: {
            ...cust,
            organizationId: org.id,
            DocumentType: "NTN",
            DocumentNumber: "1234567-8",
            State: "Capital",
            Zip: "10000",
            ActiveStatus: "Active",
            FilePath: "",
          },
          update: { PersonName: cust.PersonName },
        });
      } catch (err) {
        console.error(`Error seeding customer ${cust.CompanyName}:`, err);
      }
    }
    console.log("Seeded 12 default customers.");

    // Re-verify default shipments exist (15)
    const defaultShipments = [
      { trackingId: "DEMO-1001", invoiceNumber: "DEMO-1001", referenceNumber: "REF-88901", senderName: "Apex Global Logistics Demo", senderAddress: "Suite 404, Business Plaza, Karachi", recipientName: "TechCorp Middle East FZE", recipientAddress: "Office 12, Tech Tower, Business Bay, Dubai, UAE", destination: "Dubai, United Arab Emirates", shippingMode: "Air Express", vendor: "Skynet Express", deliveryStatus: "In Transit", trackingStatus: "Out for Delivery", amount: 1, weight: 3.5, totalCost: 14500, subtotal: 14500, price: 14500, packageDescription: "Electronic Components & Circuit Samples" },
      { trackingId: "DEMO-1002", invoiceNumber: "DEMO-1002", referenceNumber: "REF-88902", senderName: "Apex Global Logistics Demo", senderAddress: "Suite 404, Business Plaza, Karachi", recipientName: "London Fashion Hub Ltd", recipientAddress: "45 Oxford Street, London, UK", destination: "London, United Kingdom", shippingMode: "Air Cargo", vendor: "DHL Express", deliveryStatus: "Delivered", trackingStatus: "Delivered to Recipient", amount: 3, weight: 12.0, totalCost: 38000, subtotal: 38000, price: 38000, packageDescription: "Textile & Garment Samples" },
      { trackingId: "DEMO-1003", invoiceNumber: "DEMO-1003", referenceNumber: "REF-88903", senderName: "Horizon Garment Exports", senderAddress: "Gulberg III, Lahore", recipientName: "North America Cargo Corp", recipientAddress: "5th Avenue, New York, USA", destination: "New York, United States", shippingMode: "Air Express", vendor: "FedEx Express", deliveryStatus: "Delivered", trackingStatus: "Delivered to Recipient", amount: 2, weight: 8.5, totalCost: 52000, subtotal: 52000, price: 52000, packageDescription: "Leather Jackets & Apparels" },
      { trackingId: "DEMO-1004", invoiceNumber: "DEMO-1004", referenceNumber: "REF-88904", senderName: "Crescent Textile Mills", senderAddress: "Sheikhupura Road, Faisalabad", recipientName: "Gulf Electronics Trading", recipientAddress: "Olaya Street, Riyadh, Saudi Arabia", destination: "Riyadh, Saudi Arabia", shippingMode: "Air Cargo", vendor: "Aramex Express", deliveryStatus: "In Transit", trackingStatus: "Customs Clearance Passed", amount: 1, weight: 5.0, totalCost: 24000, subtotal: 24000, price: 24000, packageDescription: "Home Textile Fabrics" },
      { trackingId: "DEMO-1005", invoiceNumber: "DEMO-1005", referenceNumber: "REF-88905", senderName: "Apex Global Logistics Demo", senderAddress: "Karachi Port Terminal", recipientName: "Atlas Trading Solutions", recipientAddress: "100 Bay Street, Toronto, Canada", destination: "Toronto, Canada", shippingMode: "Sea Freight", vendor: "Maersk Line", deliveryStatus: "In Transit", trackingStatus: "Vessel Departed Port", amount: 10, weight: 240.0, totalCost: 115000, subtotal: 115000, price: 115000, packageDescription: "Industrial Machinery Parts" },
      { trackingId: "DEMO-1006", invoiceNumber: "DEMO-1006", referenceNumber: "REF-88906", senderName: "Sialkot Surgical Goods", senderAddress: "Small Industrial Estate, Sialkot", recipientName: "EuroTech Industrial Supplies", recipientAddress: "Kaiserstrasse 88, Frankfurt, Germany", destination: "Frankfurt, Germany", shippingMode: "Air Express", vendor: "DHL Express", deliveryStatus: "Delivered", trackingStatus: "Delivered to Recipient", amount: 4, weight: 14.2, totalCost: 42500, subtotal: 42500, price: 42500, packageDescription: "Surgical & Dental Instruments" },
      { trackingId: "DEMO-1007", invoiceNumber: "DEMO-1007", referenceNumber: "REF-88907", senderName: "Crescent Textile Mills", senderAddress: "Faisalabad Industrial Area", recipientName: "Manchester Garment Dist", recipientAddress: "Deansgate, Manchester, UK", destination: "Manchester, United Kingdom", shippingMode: "Air Cargo", vendor: "FedEx Express", deliveryStatus: "In Transit", trackingStatus: "In Flight to Destination", amount: 2, weight: 9.0, totalCost: 29800, subtotal: 29800, price: 29800, packageDescription: "Cotton Bed Sheets & Towels" },
      { trackingId: "DEMO-1008", invoiceNumber: "DEMO-1008", referenceNumber: "REF-88908", senderName: "TechCorp Middle East FZE", senderAddress: "Business Bay, Dubai", recipientName: "Pacific International Freight", recipientAddress: "Marina Bay Centre, Singapore", destination: "Singapore", shippingMode: "Air Express", vendor: "Skynet Express", deliveryStatus: "Delivered", trackingStatus: "Delivered to Recipient", amount: 1, weight: 4.0, totalCost: 18200, subtotal: 18200, price: 18200, packageDescription: "Microchip Processors & Sensors" },
      { trackingId: "DEMO-1009", invoiceNumber: "DEMO-1009", referenceNumber: "REF-88909", senderName: "Multan Mango Traders", senderAddress: "Industrial Estate, Multan", recipientName: "Jeddah Fresh Market", recipientAddress: "King Abdulaziz Road, Jeddah", destination: "Jeddah, Saudi Arabia", shippingMode: "Air Cargo", vendor: "Saudia Cargo", deliveryStatus: "Delivered", trackingStatus: "Delivered to Recipient", amount: 5, weight: 11.5, totalCost: 31000, subtotal: 31000, price: 31000, packageDescription: "Perishable Food Goods" },
      { trackingId: "DEMO-1010", invoiceNumber: "DEMO-1010", referenceNumber: "REF-88910", senderName: "Gujranwala Utensils Co", senderAddress: "GT Road, Gujranwala", recipientName: "Sydney Kitchenware", recipientAddress: "George Street, Sydney, Australia", destination: "Sydney, Australia", shippingMode: "Sea Freight", vendor: "MSC Lines", deliveryStatus: "In Transit", trackingStatus: "On Vessel at Sea", amount: 8, weight: 185.0, totalCost: 98000, subtotal: 98000, price: 98000, packageDescription: "Cookware & Stainless Utensils" },
      { trackingId: "DEMO-1011", invoiceNumber: "DEMO-1011", referenceNumber: "REF-88911", senderName: "Apex Global Logistics Demo", senderAddress: "I.I. Chundrigar Road, Karachi", recipientName: "Silk Road Import & Export", recipientAddress: "Levent District, Istanbul, Turkey", destination: "Istanbul, Turkey", shippingMode: "Air Cargo", vendor: "Turkish Cargo", deliveryStatus: "In Transit", trackingStatus: "Out for Delivery", amount: 2, weight: 7.8, totalCost: 27400, subtotal: 27400, price: 27400, packageDescription: "Handcrafted Carpets & Rugs" },
      { trackingId: "DEMO-1012", invoiceNumber: "DEMO-1012", referenceNumber: "REF-88912", senderName: "Horizon Garment Exports", senderAddress: "Gulberg III, Lahore", recipientName: "Tokyo Medical Devices", recipientAddress: "Chiyoda-ku, Tokyo, Japan", destination: "Tokyo, Japan", shippingMode: "Air Express", vendor: "DHL Express", deliveryStatus: "Delivered", trackingStatus: "Delivered to Recipient", amount: 1, weight: 6.2, totalCost: 49000, subtotal: 49000, price: 49000, packageDescription: "Precision Optical Instruments" },
      { trackingId: "DEMO-1013", invoiceNumber: "DEMO-1013", referenceNumber: "REF-88913", senderName: "Peshawar Handicrafts", senderAddress: "University Road, Peshawar", recipientName: "Doha Souq Trader", recipientAddress: "Souq Waqif, Doha, Qatar", destination: "Doha, Qatar", shippingMode: "Air Cargo", vendor: "Qatar Cargo", deliveryStatus: "In Transit", trackingStatus: "In Transit at Doha Hub", amount: 2, weight: 8.0, totalCost: 22000, subtotal: 22000, price: 22000, packageDescription: "Brass & Copper Craftware" },
      { trackingId: "DEMO-1014", invoiceNumber: "DEMO-1014", referenceNumber: "REF-88914", senderName: "Apex Global Logistics Demo", senderAddress: "Karachi Cargo Complex", recipientName: "Muscat Commercial Corp", recipientAddress: "Ruwi District, Muscat, Oman", destination: "Muscat, Oman", shippingMode: "Air Express", vendor: "Aramex Express", deliveryStatus: "Delivered", trackingStatus: "Delivered to Recipient", amount: 1, weight: 3.0, totalCost: 16500, subtotal: 16500, price: 16500, packageDescription: "Spare Filter Accessories" },
      { trackingId: "DEMO-1015", invoiceNumber: "DEMO-1015", referenceNumber: "REF-88915", senderName: "Rawalpindi Pharma Express", senderAddress: "Saddar, Rawalpindi", recipientName: "Berlin Health Supplies", recipientAddress: "Alexanderplatz, Berlin, Germany", destination: "Berlin, Germany", shippingMode: "Air Cargo", vendor: "Lufthansa Cargo", deliveryStatus: "Pending", trackingStatus: "Shipment Created", amount: 3, weight: 10.5, totalCost: 36000, subtotal: 36000, price: 36000, packageDescription: "Nutritional Supplements" },
    ];

    for (const ship of defaultShipments) {
      try {
        const existing = await prisma.shipment.findFirst({
          where: { organizationId: org.id, trackingId: ship.trackingId },
        });
        if (!existing) {
          await prisma.shipment.create({
            data: { ...ship, organizationId: org.id },
          });
        }
      } catch (err) {
        console.error(`Error seeding shipment ${ship.trackingId}:`, err);
      }
    }
    console.log("Seeded 15 default shipments.");

    // Re-verify default customer invoices exist (12)
    const defaultInvoices = [
      { invoiceNumber: "DEMO-1001", destination: "Dubai, UAE", weight: 3.5, profile: "Express Cargo", lineItems: JSON.stringify([{ description: "Air Freight Express", amount: 14500 }]), totalAmount: 14500, status: "PAID", invoiceDate: new Date("2026-07-15") },
      { invoiceNumber: "DEMO-1002", destination: "London, UK", weight: 12.0, profile: "General Cargo", lineItems: JSON.stringify([{ description: "Air Cargo Shipment", amount: 38000 }]), totalAmount: 38000, status: "PAID", invoiceDate: new Date("2026-07-18") },
      { invoiceNumber: "DEMO-1003", destination: "New York, USA", weight: 8.5, profile: "Express Cargo", lineItems: JSON.stringify([{ description: "Apparel Export Shipping", amount: 52000 }]), totalAmount: 52000, status: "PARTIAL", invoiceDate: new Date("2026-07-20") },
      { invoiceNumber: "DEMO-1004", destination: "Riyadh, Saudi Arabia", weight: 5.0, profile: "General Cargo", lineItems: JSON.stringify([{ description: "Textile Air Cargo", amount: 24000 }]), totalAmount: 24000, status: "UNPAID", invoiceDate: new Date("2026-07-22") },
      { invoiceNumber: "DEMO-1005", destination: "Toronto, Canada", weight: 240.0, profile: "Sea Container", lineItems: JSON.stringify([{ description: "Industrial Parts Sea Freight", amount: 115000 }]), totalAmount: 115000, status: "PAID", invoiceDate: new Date("2026-07-23") },
      { invoiceNumber: "DEMO-1006", destination: "Frankfurt, Germany", weight: 14.2, profile: "Express Cargo", lineItems: JSON.stringify([{ description: "Surgical Tools Shipping", amount: 42500 }]), totalAmount: 42500, status: "PAID", invoiceDate: new Date("2026-07-25") },
      { invoiceNumber: "DEMO-1007", destination: "Manchester, UK", weight: 9.0, profile: "General Cargo", lineItems: JSON.stringify([{ description: "Cotton Goods Cargo", amount: 29800 }]), totalAmount: 29800, status: "UNPAID", invoiceDate: new Date("2026-07-26") },
      { invoiceNumber: "DEMO-1008", destination: "Singapore", weight: 4.0, profile: "Express Cargo", lineItems: JSON.stringify([{ description: "Microchip Sensors Freight", amount: 18200 }]), totalAmount: 18200, status: "PAID", invoiceDate: new Date("2026-07-27") },
      { invoiceNumber: "DEMO-1009", destination: "Jeddah, Saudi Arabia", weight: 11.5, profile: "Perishable", lineItems: JSON.stringify([{ description: "Fresh Food Air Cargo", amount: 31000 }]), totalAmount: 31000, status: "PARTIAL", invoiceDate: new Date("2026-07-28") },
      { invoiceNumber: "DEMO-1010", destination: "Sydney, Australia", weight: 185.0, profile: "Sea Container", lineItems: JSON.stringify([{ description: "Cookware Sea Cargo", amount: 98000 }]), totalAmount: 98000, status: "PAID", invoiceDate: new Date("2026-07-29") },
      { invoiceNumber: "DEMO-1011", destination: "Istanbul, Turkey", weight: 7.8, profile: "General Cargo", lineItems: JSON.stringify([{ description: "Rugs Air Cargo", amount: 27400 }]), totalAmount: 27400, status: "PAID", invoiceDate: new Date("2026-07-30") },
      { invoiceNumber: "DEMO-1012", destination: "Tokyo, Japan", weight: 6.2, profile: "Express Cargo", lineItems: JSON.stringify([{ description: "Precision Optical Express", amount: 49000 }]), totalAmount: 49000, status: "UNPAID", invoiceDate: new Date("2026-07-31") },
    ];

    for (const inv of defaultInvoices) {
      try {
        const existing = await prisma.invoice.findFirst({
          where: { organizationId: org.id, invoiceNumber: inv.invoiceNumber },
        });
        if (!existing) {
          await prisma.invoice.create({
            data: {
              ...inv,
              organizationId: org.id,
            },
          });
        }
      } catch (err) {
        console.error(`Error seeding invoice ${inv.invoiceNumber}:`, err);
      }
    }
    console.log("Seeded 12 default invoices.");

    // Re-verify default financial transactions exist (15)
    const defaultPayments = [
      { transactionType: "INCOME", category: "Freight Charge", amount: 14500, mode: "BANK_TRANSFER", reference: "DEMO-SEED-01", invoice: "DEMO-1001", description: "Customer Payment for Electronics Cargo (DEMO-1001)" },
      { transactionType: "INCOME", category: "Freight Charge", amount: 38000, mode: "BANK_TRANSFER", reference: "DEMO-SEED-02", invoice: "DEMO-1002", description: "Customer Payment for Garments Shipment (DEMO-1002)" },
      { transactionType: "INCOME", category: "Freight Charge", amount: 26000, mode: "CASH", reference: "DEMO-SEED-03", invoice: "DEMO-1003", description: "Partial Payment for Leather Apparel Shipment (DEMO-1003)" },
      { transactionType: "EXPENSE", category: "Freight Charge", amount: 28500, mode: "BANK_TRANSFER", reference: "DEMO-SEED-04", invoice: null, description: "Carrier Freight Settlement to DHL Express" },
      { transactionType: "EXPENSE", category: "Custom Clearance", amount: 12000, mode: "CASH", reference: "DEMO-SEED-05", invoice: null, description: "Airport Customs Clearance & Terminal Charges" },
      { transactionType: "EXPENSE", category: "Packaging Material", amount: 4800, mode: "BANK_TRANSFER", reference: "DEMO-SEED-06", invoice: null, description: "Heavy Wooden Crating & Protective Bubble Wrapping" },
      { transactionType: "EXPENSE", category: "Utilities", amount: 18500, mode: "BANK_TRANSFER", reference: "DEMO-SEED-07", invoice: null, description: "Main Warehouse Monthly Electricity & Power Bill" },
      { transactionType: "INCOME", category: "Freight Charge", amount: 115000, mode: "BANK_TRANSFER", reference: "DEMO-SEED-08", invoice: "DEMO-1005", description: "Full Payment for Sea Container Cargo to Toronto (DEMO-1005)" },
      { transactionType: "EXPENSE", category: "Freight Charge", amount: 35000, mode: "BANK_TRANSFER", reference: "DEMO-SEED-09", invoice: null, description: "FedEx Express Carrier Settlement" },
      { transactionType: "INCOME", category: "Freight Charge", amount: 42500, mode: "BANK_TRANSFER", reference: "DEMO-SEED-10", invoice: "DEMO-1006", description: "Payment for Surgical Equipment Air Cargo (DEMO-1006)" },
      { transactionType: "EXPENSE", category: "Office Supplies", amount: 45000, mode: "BANK_TRANSFER", reference: "DEMO-SEED-11", invoice: null, description: "Office Space Monthly Lease & Facilities Maintenance" },
      { transactionType: "INCOME", category: "Freight Charge", amount: 18200, mode: "BANK_TRANSFER", reference: "DEMO-SEED-12", invoice: "DEMO-1008", description: "Express Microchip Shipment Settlement (DEMO-1008)" },
      { transactionType: "EXPENSE", category: "Vendor Payment", amount: 11200, mode: "BANK_TRANSFER", reference: "DEMO-SEED-13", invoice: null, description: "Skynet Express Monthly Air Cargo Settlement" },
      { transactionType: "INCOME", category: "Freight Charge", amount: 98000, mode: "BANK_TRANSFER", reference: "DEMO-SEED-14", invoice: "DEMO-1010", description: "Sea Freight Payment for Sydney Utensils (DEMO-1010)" },
      { transactionType: "EXPENSE", category: "Fuel Surcharge", amount: 6500, mode: "CASH", reference: "DEMO-SEED-15", invoice: null, description: "Monthly Airport Fuel & Security Surcharge Adjustment" },
    ];

    for (const pay of defaultPayments) {
      try {
        const existing = await prisma.payment.findFirst({
          where: { organizationId: org.id, reference: pay.reference },
        });
        if (!existing) {
          await prisma.payment.create({
            data: {
              ...pay,
              transactionType: pay.transactionType as any,
              mode: pay.mode as any,
              organizationId: org.id,
              date: new Date(),
              fromPartyType: "US",
              toPartyType: "US",
              fromCustomer: "Us",
              toVendor: "Us",
            },
          });
        }
      } catch (err) {
        console.error(`Error seeding payment ${pay.reference}:`, err);
      }
    }
    console.log("Seeded 15 default financial payments.");

    console.log("Demo account user entries reset successfully (defaults preserved).");
  } catch (error) {
    console.error("Error resetting demo account entries:", error);
  }
}
