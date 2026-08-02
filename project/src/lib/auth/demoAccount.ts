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
 * Completely resets and seeds the demo organization data with realistic financial and operational logic.
 */
export async function resetDemoUserEntries() {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: DEMO_ORG_SLUG },
    });

    if (!org) return;

    console.log(`[resetDemoUserEntries] Cleaning demo organization ID ${org.id}...`);

    // 1. Delete ALL financial records for the demo org to ensure a clean slate
    await prisma.journalEntryLine.deleteMany({
      where: { journalEntry: { organizationId: org.id } }
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: org.id }
    });
    await prisma.customerTransaction.deleteMany({
      where: { organizationId: org.id }
    });
    await prisma.vendorTransaction.deleteMany({
      where: { organizationId: org.id }
    });
    await prisma.payment.deleteMany({
      where: { organizationId: org.id }
    });
    await prisma.invoice.deleteMany({
      where: { organizationId: org.id }
    });

    // 2. Delete user-added shipments (keep default DEMO-10xx)
    const delShip = await prisma.shipment.deleteMany({
      where: {
        organizationId: org.id,
        NOT: { trackingId: { startsWith: "DEMO-10" } },
      },
    });
    console.log(`Deleted ${delShip.count} user-added shipments.`);

    // 3. Delete user-added vendors and customers (keep default lists)
    const defaultVendorNames = [
      "DHL Express", "FedEx Express", "Skynet Express", "Aramex Express",
      "Maersk Line", "MSC Lines", "Saudia Cargo", "Turkish Cargo",
      "Qatar Cargo", "Lufthansa Cargo"
    ];
    await prisma.vendors.deleteMany({
      where: {
        organizationId: org.id,
        NOT: { CompanyName: { in: defaultVendorNames } },
      },
    });

    const defaultCustomerNames = [
      "Apex Global Logistics Demo", "TechCorp Middle East FZE", "London Fashion Hub Ltd",
      "Gulf Electronics Trading", "Crescent Textile Mills", "Silk Road Import & Export",
      "EuroTech Industrial Supplies", "Pacific International Freight", "Atlas Trading Solutions",
      "Horizon Garment Exports", "Tokyo Medical Devices", "North America Cargo Corp"
    ];
    await prisma.customers.deleteMany({
      where: {
        organizationId: org.id,
        NOT: { CompanyName: { in: defaultCustomerNames } },
      },
    });

    // --- SEED VENDORS ---
    const defaultVendors = [
      { CompanyName: "DHL Express", PersonName: "John Smith", Email: "contact@dhl.demo", Phone: "+49 228 1820", Country: "Germany", State: "Hesse", City: "Frankfurt", Zip: "60313", Address: "Frankfurt Airport" },
      { CompanyName: "FedEx Express", PersonName: "Jane Doe", Email: "contact@fedex.demo", Phone: "+1 800 463 3339", Country: "USA", State: "TN", City: "Memphis", Zip: "38118", Address: "Memphis Intl Airport" },
      { CompanyName: "Skynet Express", PersonName: "Ali Khan", Email: "contact@skynet.demo", Phone: "+92 21 111 759 638", Country: "Pakistan", State: "Sindh", City: "Karachi", Zip: "75200", Address: "Shahrah-e-Faisal" },
      { CompanyName: "Aramex Express", PersonName: "Tariq Ali", Email: "contact@aramex.demo", Phone: "+971 600 544000", Country: "UAE", State: "Dubai", City: "Dubai", Zip: "00000", Address: "Dubai Airport Free Zone" },
      { CompanyName: "Maersk Line", PersonName: "Soren Larsen", Email: "contact@maersk.demo", Phone: "+45 33 63 33 63", Country: "Denmark", State: "Capital", City: "Copenhagen", Zip: "1098", Address: "Esplanaden 50" },
      { CompanyName: "MSC Lines", PersonName: "Gianni Aponte", Email: "contact@msc.demo", Phone: "+41 22 703 8888", Country: "Switzerland", State: "Geneva", City: "Geneva", Zip: "1206", Address: "12-14 Chemin Rieu" },
      { CompanyName: "Saudia Cargo", PersonName: "Fahad Al Saud", Email: "contact@saudiacargo.demo", Phone: "+966 9200 03111", Country: "Saudi Arabia", State: "Makkah", City: "Jeddah", Zip: "21231", Address: "King Abdulaziz Intl Airport" },
      { CompanyName: "Turkish Cargo", PersonName: "Ahmet Yilmaz", Email: "contact@turkishcargo.demo", Phone: "+90 850 333 0777", Country: "Turkey", State: "Istanbul", City: "Istanbul", Zip: "34283", Address: "Istanbul Airport" },
      { CompanyName: "Qatar Cargo", PersonName: "Hassan Al Thani", Email: "contact@qrcargo.demo", Phone: "+974 4423 5077", Country: "Qatar", State: "Doha", City: "Doha", Zip: "22550", Address: "Hamad Intl Airport" },
      { CompanyName: "Lufthansa Cargo", PersonName: "Klaus Becker", Email: "contact@lhcargo.demo", Phone: "+49 180 6 747 100", Country: "Germany", State: "Hesse", City: "Frankfurt", Zip: "60546", Address: "Frankfurt Airport" },
    ];

    for (const v of defaultVendors) {
      await prisma.vendors.upsert({
        where: { organizationId_CompanyName: { organizationId: org.id, CompanyName: v.CompanyName } },
        create: { ...v, organizationId: org.id, currentBalance: 0, creditLimit: 500000 },
        update: { currentBalance: 0 } // reset balance
      });
    }

    // --- SEED CUSTOMERS ---
    const defaultCustomersData = [
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

    for (const cust of defaultCustomersData) {
      await prisma.customers.upsert({
        where: { organizationId_CompanyName: { organizationId: org.id, CompanyName: cust.CompanyName } },
        create: {
          ...cust,
          organizationId: org.id,
          DocumentType: "NTN",
          DocumentNumber: "1234567-8",
          State: "Capital",
          Zip: "10000",
          ActiveStatus: "Active",
          FilePath: "",
          currentBalance: 0,
          creditLimit: 500000
        },
        update: { currentBalance: 0 } // reset balance
      });
    }

    // --- SEED CHART OF ACCOUNTS ---
    const defaultCOA = [
      { code: "1101", accountName: "Cash & Bank Account", category: "Asset", type: "Current Asset", debitRule: "Increase", creditRule: "Decrease", description: "Main operating account" },
      { code: "1102", accountName: "Accounts Receivable", category: "Asset", type: "Current Asset", debitRule: "Increase", creditRule: "Decrease", description: "Customer receivables" },
      { code: "2101", accountName: "Accounts Payable", category: "Liability", type: "Current Liability", debitRule: "Decrease", creditRule: "Increase", description: "Vendor payables" },
      { code: "3101", accountName: "Owner's Equity", category: "Equity", type: "Equity", debitRule: "Decrease", creditRule: "Increase", description: "Business equity" },
      { code: "4101", accountName: "Logistics Services Revenue", category: "Revenue", type: "Operating Revenue", debitRule: "Decrease", creditRule: "Increase", description: "Core revenue" },
      { code: "5101", accountName: "Cost of Services", category: "Expense", type: "COGS", debitRule: "Increase", creditRule: "Decrease", description: "Direct costs of shipments" },
      { code: "5201", accountName: "Operating Expenses", category: "Expense", type: "Operating Expense", debitRule: "Increase", creditRule: "Decrease", description: "General OPEX" },
      { code: "5301", accountName: "Fuel & Surcharges", category: "Expense", type: "Operating Expense", debitRule: "Increase", creditRule: "Decrease", description: "Fuel and external surcharges" },
    ];

    for (const c of defaultCOA) {
      await prisma.chartOfAccount.upsert({
        where: { organizationId_code: { organizationId: org.id, code: c.code } },
        create: { ...c, organizationId: org.id },
        update: { accountName: c.accountName }
      });
    }

    const coaList = await prisma.chartOfAccount.findMany({ where: { organizationId: org.id } });
    const getAcctId = (code: string) => {
      const id = coaList.find(a => a.code === code)?.id;
      if (!id) throw new Error(`Account ${code} not found`);
      return id;
    };

    // --- SHIPMENT MASTER DATA ---
    const shipmentData = [
      {
        trackingId: "DEMO-1001", _customerName: "Apex Global Logistics Demo",
        senderName: "Apex Global Logistics Demo", senderAddress: "Suite 404, Business Plaza, Karachi",
        recipientName: "TechCorp Middle East FZE", recipientAddress: "Office 12, Tech Tower, Business Bay, Dubai, UAE",
        destination: "Dubai UAE", shippingMode: "Air Express", vendor: "Skynet Express",
        deliveryStatus: "Delivered", weight: 3.5, totalCost: 14500, cos: 9425,
        _invoiceStatus: "PAID", _paidByCustomer: 14500, _vendorPaid: true, _shipDate: "2026-05-12"
      },
      {
        trackingId: "DEMO-1002", _customerName: "Apex Global Logistics Demo",
        senderName: "Apex Global Logistics Demo", senderAddress: "Suite 404, Business Plaza, Karachi",
        recipientName: "London Fashion Hub Ltd", recipientAddress: "45 Oxford Street, London, UK",
        destination: "London UK", shippingMode: "Air Cargo", vendor: "DHL Express",
        deliveryStatus: "Delivered", weight: 12.0, totalCost: 38000, cos: 24700,
        _invoiceStatus: "PAID", _paidByCustomer: 38000, _vendorPaid: true, _shipDate: "2026-05-18"
      },
      {
        trackingId: "DEMO-1003", _customerName: "Horizon Garment Exports",
        senderName: "Horizon Garment Exports", senderAddress: "Gulberg III, Lahore",
        recipientName: "North America Cargo Corp", recipientAddress: "5th Avenue, New York, USA",
        destination: "New York USA", shippingMode: "Air Express", vendor: "FedEx Express",
        deliveryStatus: "Delivered", weight: 8.5, totalCost: 52000, cos: 33800,
        _invoiceStatus: "PARTIAL", _paidByCustomer: 26000, _vendorPaid: true, _shipDate: "2026-05-25"
      },
      {
        trackingId: "DEMO-1004", _customerName: "Crescent Textile Mills",
        senderName: "Crescent Textile Mills", senderAddress: "Sheikhupura Road, Faisalabad",
        recipientName: "Gulf Electronics Trading", recipientAddress: "Olaya Street, Riyadh, Saudi Arabia",
        destination: "Riyadh SA", shippingMode: "Air Cargo", vendor: "Aramex Express",
        deliveryStatus: "In Transit", weight: 5.0, totalCost: 24000, cos: 15600,
        _invoiceStatus: "UNPAID", _paidByCustomer: 0, _vendorPaid: false, _shipDate: "2026-06-05"
      },
      {
        trackingId: "DEMO-1005", _customerName: "Apex Global Logistics Demo",
        senderName: "Apex Global Logistics Demo", senderAddress: "Karachi Port Terminal",
        recipientName: "Atlas Trading Solutions", recipientAddress: "100 Bay Street, Toronto, Canada",
        destination: "Toronto Canada", shippingMode: "Sea Freight", vendor: "Maersk Line",
        deliveryStatus: "In Transit", weight: 240.0, totalCost: 115000, cos: 74750,
        _invoiceStatus: "PAID", _paidByCustomer: 115000, _vendorPaid: true, _shipDate: "2026-06-10"
      },
      {
        trackingId: "DEMO-1006", _customerName: "EuroTech Industrial Supplies",
        senderName: "Sialkot Surgical Goods", senderAddress: "Small Industrial Estate, Sialkot",
        recipientName: "EuroTech Industrial Supplies", recipientAddress: "Kaiserstrasse 88, Frankfurt, Germany",
        destination: "Frankfurt Germany", shippingMode: "Air Express", vendor: "DHL Express",
        deliveryStatus: "Delivered", weight: 14.2, totalCost: 42500, cos: 27625,
        _invoiceStatus: "PAID", _paidByCustomer: 42500, _vendorPaid: true, _shipDate: "2026-06-18"
      },
      {
        trackingId: "DEMO-1007", _customerName: "Crescent Textile Mills",
        senderName: "Crescent Textile Mills", senderAddress: "Faisalabad Industrial Area",
        recipientName: "Manchester Garment Dist", recipientAddress: "Deansgate, Manchester, UK",
        destination: "Manchester UK", shippingMode: "Air Cargo", vendor: "FedEx Express",
        deliveryStatus: "In Transit", weight: 9.0, totalCost: 29800, cos: 19370,
        _invoiceStatus: "UNPAID", _paidByCustomer: 0, _vendorPaid: false, _shipDate: "2026-06-22"
      },
      {
        trackingId: "DEMO-1008", _customerName: "TechCorp Middle East FZE",
        senderName: "TechCorp Middle East FZE", senderAddress: "Business Bay, Dubai",
        recipientName: "Pacific International Freight", recipientAddress: "Marina Bay Centre, Singapore",
        destination: "Singapore", shippingMode: "Air Express", vendor: "Skynet Express",
        deliveryStatus: "Delivered", weight: 4.0, totalCost: 18200, cos: 11830,
        _invoiceStatus: "PAID", _paidByCustomer: 18200, _vendorPaid: true, _shipDate: "2026-07-01"
      },
      {
        trackingId: "DEMO-1009", _customerName: "Gulf Electronics Trading",
        senderName: "Multan Mango Traders", senderAddress: "Industrial Estate, Multan",
        recipientName: "Jeddah Fresh Market", recipientAddress: "King Abdulaziz Road, Jeddah, Saudi Arabia",
        destination: "Jeddah SA", shippingMode: "Air Cargo", vendor: "Saudia Cargo",
        deliveryStatus: "Delivered", weight: 11.5, totalCost: 31000, cos: 20150,
        _invoiceStatus: "PARTIAL", _paidByCustomer: 15500, _vendorPaid: false, _shipDate: "2026-07-08"
      },
      {
        trackingId: "DEMO-1010", _customerName: "Pacific International Freight",
        senderName: "Gujranwala Utensils Co", senderAddress: "GT Road, Gujranwala",
        recipientName: "Sydney Kitchenware", recipientAddress: "George Street, Sydney, Australia",
        destination: "Sydney Australia", shippingMode: "Sea Freight", vendor: "MSC Lines",
        deliveryStatus: "In Transit", weight: 185.0, totalCost: 98000, cos: 63700,
        _invoiceStatus: "PAID", _paidByCustomer: 98000, _vendorPaid: true, _shipDate: "2026-07-12"
      },
      {
        trackingId: "DEMO-1011", _customerName: "Silk Road Import & Export",
        senderName: "Apex Global Logistics Demo", senderAddress: "I.I. Chundrigar Road, Karachi",
        recipientName: "Silk Road Import & Export", recipientAddress: "Levent District, Istanbul, Turkey",
        destination: "Istanbul Turkey", shippingMode: "Air Cargo", vendor: "Turkish Cargo",
        deliveryStatus: "In Transit", weight: 7.8, totalCost: 27400, cos: 17810,
        _invoiceStatus: "PAID", _paidByCustomer: 27400, _vendorPaid: true, _shipDate: "2026-07-18"
      },
      {
        trackingId: "DEMO-1012", _customerName: "Horizon Garment Exports",
        senderName: "Horizon Garment Exports", senderAddress: "Gulberg III, Lahore",
        recipientName: "Tokyo Medical Devices", recipientAddress: "Chiyoda-ku, Tokyo, Japan",
        destination: "Tokyo Japan", shippingMode: "Air Express", vendor: "DHL Express",
        deliveryStatus: "Delivered", weight: 6.2, totalCost: 49000, cos: 31850,
        _invoiceStatus: "UNPAID", _paidByCustomer: 0, _vendorPaid: false, _shipDate: "2026-07-25"
      },
      {
        trackingId: "DEMO-1013", _customerName: "Atlas Trading Solutions",
        senderName: "Peshawar Handicrafts", senderAddress: "University Road, Peshawar",
        recipientName: "Doha Souq Trader", recipientAddress: "Souq Waqif, Doha, Qatar",
        destination: "Doha Qatar", shippingMode: "Air Cargo", vendor: "Qatar Cargo",
        deliveryStatus: "In Transit", weight: 8.0, totalCost: 22000, cos: 14300,
        _invoiceStatus: "UNPAID", _paidByCustomer: 0, _vendorPaid: false, _shipDate: "2026-07-28"
      },
      {
        trackingId: "DEMO-1014", _customerName: "London Fashion Hub Ltd",
        senderName: "Apex Global Logistics Demo", senderAddress: "Karachi Cargo Complex",
        recipientName: "Muscat Commercial Corp", recipientAddress: "Ruwi District, Muscat, Oman",
        destination: "Muscat Oman", shippingMode: "Air Express", vendor: "Aramex Express",
        deliveryStatus: "Delivered", weight: 3.0, totalCost: 16500, cos: 10725,
        _invoiceStatus: "PAID", _paidByCustomer: 16500, _vendorPaid: true, _shipDate: "2026-07-30"
      },
      {
        trackingId: "DEMO-1015", _customerName: "North America Cargo Corp",
        senderName: "Rawalpindi Pharma Express", senderAddress: "Saddar, Rawalpindi",
        recipientName: "Berlin Health Supplies", recipientAddress: "Alexanderplatz, Berlin, Germany",
        destination: "Berlin Germany", shippingMode: "Air Cargo", vendor: "Lufthansa Cargo",
        deliveryStatus: "Pending", weight: 10.5, totalCost: 36000, cos: 23400,
        _invoiceStatus: "UNPAID", _paidByCustomer: 0, _vendorPaid: false, _shipDate: "2026-08-01"
      }
    ];

    // Caches and sequence counters
    const customersCache = await prisma.customers.findMany({ where: { organizationId: org.id } });
    const vendorsCache = await prisma.vendors.findMany({ where: { organizationId: org.id } });

    const getCust = (name: string) => customersCache.find(c => c.CompanyName === name);
    const getVend = (name: string) => vendorsCache.find(v => v.CompanyName === name);

    let jeCounter = 1;
    const nextJe = () => `DEMO-JE-${String(jeCounter++).padStart(3, '0')}`;
    let ctCounter = 1;
    const nextCt = () => `DEMO-CT-${String(ctCounter++).padStart(3, '0')}`;
    let vtCounter = 1;
    const nextVt = () => `DEMO-VT-${String(vtCounter++).padStart(3, '0')}`;
    let payCounter = 1;
    const nextPay = () => `DEMO-PAY-${String(payCounter++).padStart(3, '0')}`;
    let vPayCounter = 1;
    const nextVPay = () => `DEMO-VPAY-${String(vPayCounter++).padStart(3, '0')}`;

    console.log("Seeding 15 shipments and corresponding financials...");

    for (const [idx, data] of shipmentData.entries()) {
      try {
        const refNumber = `REF-889${String(idx + 1).padStart(2, '0')}`;
        const shipDate = new Date(data._shipDate);

        // Create Shipment
        const shipment = await prisma.shipment.upsert({
          where: { organizationId_trackingId: { organizationId: org.id, trackingId: data.trackingId } },
          create: {
            organizationId: org.id,
            trackingId: data.trackingId,
            invoiceNumber: data.trackingId,
            referenceNumber: refNumber,
            senderName: data.senderName,
            senderAddress: data.senderAddress,
            recipientName: data.recipientName,
            recipientAddress: data.recipientAddress,
            destination: data.destination,
            deliveryStatus: data.deliveryStatus,
            shippingMode: data.shippingMode,
            vendor: data.vendor,
            weight: data.weight,
            totalCost: data.totalCost,
            subtotal: data.totalCost,
            price: data.totalCost,
            cos: data.cos,
            shipmentDate: shipDate,
            packageDescription: "General Cargo Logistics",
            trackingStatus: "Dispatched",
            amount: 1
          },
          update: {
            totalCost: data.totalCost, cos: data.cos, shipmentDate: shipDate
          }
        });

        const cust = getCust(data._customerName);
        const vend = getVend(data.vendor);

        if (!cust) throw new Error(`Customer ${data._customerName} not found`);
        if (!vend) throw new Error(`Vendor ${data.vendor} not found`);

        // Create Customer Invoice
        await prisma.invoice.create({
          data: {
            organizationId: org.id,
            invoiceNumber: data.trackingId,
            invoiceDate: shipDate,
            destination: data.destination,
            weight: data.weight,
            profile: "Customer",
            lineItems: [{ description: "Freight Charges", amount: data.totalCost }],
            customerId: cust.id,
            shipmentId: shipment.id,
            status: data._invoiceStatus,
            totalAmount: data.totalCost,
            currency: "PKR"
          }
        });

        // Create Vendor Invoice
        const vendorInvoiceNum = `DEMO-V-${data.trackingId.split('-')[1]}`;
        await prisma.invoice.create({
          data: {
            organizationId: org.id,
            invoiceNumber: vendorInvoiceNum,
            invoiceDate: shipDate,
            destination: data.destination,
            weight: data.weight,
            profile: "Vendor",
            lineItems: [{ description: "Carrier Cost", amount: data.cos }],
            vendorId: vend.id,
            shipmentId: shipment.id,
            status: data._vendorPaid ? "PAID" : "UNPAID",
            totalAmount: data.cos,
            currency: "PKR"
          }
        });

        // Customer DEBIT (Owes us)
        const prevCustBal = cust.currentBalance;
        cust.currentBalance -= data.totalCost; // Negative balance implies they owe us
        await prisma.customerTransaction.create({
          data: {
            organizationId: org.id,
            customerId: cust.id,
            type: "DEBIT",
            amount: data.totalCost,
            description: `Invoice ${data.trackingId}`,
            reference: nextCt(),
            invoice: data.trackingId,
            previousBalance: prevCustBal,
            newBalance: cust.currentBalance
          }
        });

        // Vendor DEBIT (We owe them)
        const prevVendBal = vend.currentBalance;
        vend.currentBalance += data.cos; // Positive balance implies we owe them
        await prisma.vendorTransaction.create({
          data: {
            organizationId: org.id,
            vendorId: vend.id,
            type: "DEBIT",
            amount: data.cos,
            description: `Bill ${vendorInvoiceNum}`,
            reference: nextVt(),
            invoice: vendorInvoiceNum,
            previousBalance: prevVendBal,
            newBalance: vend.currentBalance
          }
        });

        // JE: Customer Invoice
        await prisma.journalEntry.create({
          data: {
            organizationId: org.id,
            entryNumber: nextJe(),
            date: shipDate,
            description: `Sales Revenue for ${data.trackingId}`,
            reference: data.trackingId,
            totalDebit: data.totalCost,
            totalCredit: data.totalCost,
            isPosted: true,
            postedAt: new Date(),
            lines: {
              create: [
                { accountId: getAcctId("1102"), debitAmount: data.totalCost, description: "Accounts Receivable" },
                { accountId: getAcctId("4101"), creditAmount: data.totalCost, description: "Revenue" }
              ]
            }
          }
        });

        // JE: Vendor Invoice
        await prisma.journalEntry.create({
          data: {
            organizationId: org.id,
            entryNumber: nextJe(),
            date: shipDate,
            description: `Cost of Sales for ${vendorInvoiceNum}`,
            reference: vendorInvoiceNum,
            totalDebit: data.cos,
            totalCredit: data.cos,
            isPosted: true,
            postedAt: new Date(),
            lines: {
              create: [
                { accountId: getAcctId("5101"), debitAmount: data.cos, description: "Cost of Services" },
                { accountId: getAcctId("2101"), creditAmount: data.cos, description: "Accounts Payable" }
              ]
            }
          }
        });

        // Process Customer Payment if any
        if (data._paidByCustomer > 0) {
          const pRef = nextPay();
          await prisma.payment.create({
            data: {
              organizationId: org.id,
              transactionType: "INCOME" as any,
              category: "Freight Charge",
              date: shipDate,
              amount: data._paidByCustomer,
              fromPartyType: "CUSTOMER" as any,
              fromCustomerId: cust.id,
              fromCustomer: cust.CompanyName,
              toPartyType: "US" as any,
              toVendor: "Us",
              mode: "BANK_TRANSFER" as any,
              reference: pRef,
              invoice: data.trackingId,
              description: `Payment for ${data.trackingId}`
            }
          });

          const pcb = cust.currentBalance;
          cust.currentBalance += data._paidByCustomer;
          await prisma.customerTransaction.create({
            data: {
              organizationId: org.id,
              customerId: cust.id,
              type: "CREDIT",
              amount: data._paidByCustomer,
              description: `Payment Recv ${pRef}`,
              reference: nextCt(),
              invoice: data.trackingId,
              previousBalance: pcb,
              newBalance: cust.currentBalance
            }
          });

          await prisma.journalEntry.create({
            data: {
              organizationId: org.id,
              entryNumber: nextJe(),
              date: shipDate,
              description: `Payment received for ${data.trackingId}`,
              reference: pRef,
              totalDebit: data._paidByCustomer,
              totalCredit: data._paidByCustomer,
              isPosted: true,
              postedAt: new Date(),
              lines: {
                create: [
                  { accountId: getAcctId("1101"), debitAmount: data._paidByCustomer, description: "Cash/Bank" },
                  { accountId: getAcctId("1102"), creditAmount: data._paidByCustomer, description: "Accounts Receivable" }
                ]
              }
            }
          });
        }

        // Process Vendor Payment if paid
        if (data._vendorPaid) {
          const vpRef = nextVPay();
          await prisma.payment.create({
            data: {
              organizationId: org.id,
              transactionType: "EXPENSE" as any,
              category: "Freight Carrier",
              date: shipDate,
              amount: data.cos,
              fromPartyType: "US" as any,
              fromCustomer: "Us",
              toPartyType: "VENDOR" as any,
              toVendorId: vend.id,
              toVendor: vend.CompanyName,
              mode: "BANK_TRANSFER" as any,
              reference: vpRef,
              invoice: vendorInvoiceNum,
              description: `Settlement for ${vendorInvoiceNum}`
            }
          });

          const pvb = vend.currentBalance;
          vend.currentBalance -= data.cos;
          await prisma.vendorTransaction.create({
            data: {
              organizationId: org.id,
              vendorId: vend.id,
              type: "CREDIT",
              amount: data.cos,
              description: `Payment Sent ${vpRef}`,
              reference: nextVt(),
              invoice: vendorInvoiceNum,
              previousBalance: pvb,
              newBalance: vend.currentBalance
            }
          });

          await prisma.journalEntry.create({
            data: {
              organizationId: org.id,
              entryNumber: nextJe(),
              date: shipDate,
              description: `Vendor payment for ${vendorInvoiceNum}`,
              reference: vpRef,
              totalDebit: data.cos,
              totalCredit: data.cos,
              isPosted: true,
              postedAt: new Date(),
              lines: {
                create: [
                  { accountId: getAcctId("2101"), debitAmount: data.cos, description: "Accounts Payable" },
                  { accountId: getAcctId("1101"), creditAmount: data.cos, description: "Cash/Bank" }
                ]
              }
            }
          });
        }
      } catch (err) {
        console.error(`Error processing shipment ${data.trackingId}:`, err);
      }
    }

    // --- SEED OPERATING EXPENSES ---
    const opexList = [
      { desc: "Utilities", amt: 18500, date: new Date("2026-06-30"), acct: "5201" },
      { desc: "Office Rent", amt: 45000, date: new Date("2026-07-01"), acct: "5201" },
      { desc: "Fuel Surcharge Adjustment", amt: 6500, date: new Date("2026-07-15"), acct: "5301" }
    ];

    let opexCounter = 1;
    for (const opex of opexList) {
      try {
        const oRef = `DEMO-OPEX-00${opexCounter++}`;
        await prisma.payment.create({
          data: {
            organizationId: org.id,
            transactionType: "EXPENSE" as any,
            category: "Operating Expense",
            date: opex.date,
            amount: opex.amt,
            fromPartyType: "US" as any,
            fromCustomer: "Us",
            toPartyType: "US" as any,
            toVendor: "Us",
            mode: "BANK_TRANSFER" as any,
            reference: oRef,
            description: opex.desc
          }
        });

        await prisma.journalEntry.create({
          data: {
            organizationId: org.id,
            entryNumber: nextJe(),
            date: opex.date,
            description: opex.desc,
            reference: oRef,
            totalDebit: opex.amt,
            totalCredit: opex.amt,
            isPosted: true,
            postedAt: new Date(),
            lines: {
              create: [
                { accountId: getAcctId(opex.acct), debitAmount: opex.amt, description: opex.desc },
                { accountId: getAcctId("1101"), creditAmount: opex.amt, description: "Cash/Bank" }
              ]
            }
          }
        });
      } catch (err) {
        console.error(`Error processing OPEX ${opex.desc}:`, err);
      }
    }

    // --- FINALLY UPDATE CUSTOMER & VENDOR BALANCES ---
    console.log("Updating final balances...");
    for (const c of customersCache) {
      await prisma.customers.update({
        where: { id: c.id },
        data: { currentBalance: c.currentBalance }
      });
    }
    for (const v of vendorsCache) {
      await prisma.vendors.update({
        where: { id: v.id },
        data: { currentBalance: v.currentBalance }
      });
    }

    console.log("Demo account user entries reset successfully (defaults preserved).");
  } catch (error) {
    console.error("Error resetting demo account entries:", error);
  }
}
