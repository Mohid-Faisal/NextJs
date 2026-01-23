import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { 
  generateInvoiceNumber, 
  generateVendorInvoiceNumber, 
  addCustomerTransaction, 
  addVendorTransaction, 
  addCompanyTransaction, 
  createJournalEntryForTransaction,
  getCountryNameFromCode 
} from "@/lib/utils";
import { Country } from "country-state-city";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "File is required" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file type. Please upload an Excel file.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    // Find header row
    let headerRowIndex = 0;
    const headerRow = raw[0] || [];
    
    // Map column names to indices
    const getColumnIndex = (header: string, alternatives: string[] = []) => {
      const searchTerms = [header, ...alternatives].map(h => h.toLowerCase().trim());
      for (let i = 0; i < headerRow.length; i++) {
        const cellValue = String(headerRow[i] || "").toLowerCase().trim();
        if (searchTerms.some(term => cellValue === term || cellValue.includes(term))) {
          return i;
        }
      }
      return -1;
    };

    const columnIndices = {
      date: getColumnIndex("date", ["shipment date", "date"]),
      tracking: getColumnIndex("tracking", ["tracking id", "trackingid", "tracking_id"]),
      sender: getColumnIndex("sender", ["sender name", "sendername", "sender_name"]),
      receiver: getColumnIndex("receiver", ["recipient", "receiver name", "receivername", "receiver_name"]),
      country: getColumnIndex("country", ["destination", "dest"]),
      shippingMode: getColumnIndex("shipping mode", ["shippingmode", "shipping_mode", "mode"]),
      type: getColumnIndex("type", ["packaging", "doc type", "doctype", "doc_type"]),
      vendor: getColumnIndex("vendor", ["vendor name", "vendorname", "vendor_name"]),
      serviceMode: getColumnIndex("service mode", ["servicemode", "service_mode", "service"]),
      status: getColumnIndex("status", ["delivery status", "deliverystatus", "delivery_status"]),
      pcs: getColumnIndex("pcs", ["pieces", "amount", "qty", "quantity"]),
      description: getColumnIndex("description", ["desc", "package description", "packagedescription"]),
      weight: getColumnIndex("weigl", ["weight", "weigh"]),
      vendorWeight: getColumnIndex("vendor weigl", ["vendor weight", "vendorweight", "vendor_weight"]),
      price: getColumnIndex("price", ["total", "total price", "totalprice"]),
      cos: getColumnIndex("cos", ["cost of service", "costofservice", "cost_of_service", "cost"]),
    };

    // Validate required columns
    const requiredColumns = ["date", "tracking", "sender", "receiver", "country", "vendor", "serviceMode", "price"];
    const missingColumns = requiredColumns.filter(col => columnIndices[col as keyof typeof columnIndices] === -1);
    
    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Missing required columns: ${missingColumns.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Parse data rows
    const shipmentsData: any[] = [];
    const errors: string[] = [];
    const allCountries = Country.getAllCountries();

    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];
      
      // Skip empty rows
      if (!row || row.every((cell: any) => cell === null || cell === undefined || cell === "")) {
        continue;
      }

      try {
        // Extract data from row
        const dateValue = row[columnIndices.date];
        const trackingId = String(row[columnIndices.tracking] || "").trim();
        const senderName = String(row[columnIndices.sender] || "").trim();
        const receiverName = String(row[columnIndices.receiver] || "").trim();
        const countryName = String(row[columnIndices.country] || "").trim();
        const shippingMode = String(row[columnIndices.shippingMode] || "Courier").trim();
        const type = String(row[columnIndices.type] || "Document").trim();
        const vendorName = String(row[columnIndices.vendor] || "").trim();
        const serviceMode = String(row[columnIndices.serviceMode] || "").trim();
        const status = String(row[columnIndices.status] || "Pending").trim();
        const pcs = parseFloat(row[columnIndices.pcs] || "1") || 1;
        const description = String(row[columnIndices.description] || "").trim();
        const weight = parseFloat(row[columnIndices.weight] || "0") || 0;
        const vendorWeight = parseFloat(row[columnIndices.vendorWeight] || String(weight)) || weight;
        const price = parseFloat(String(row[columnIndices.price] || "0").replace(/,/g, "")) || 0;
        const cos = parseFloat(String(row[columnIndices.cos] || "0").replace(/,/g, "")) || 0;

        // Validate required fields
        if (!trackingId || !senderName || !receiverName || !countryName || !vendorName || !serviceMode) {
          errors.push(`Row ${i + 1}: Missing required fields`);
          continue;
        }

        // Convert country name to country code
        let countryCode = countryName;
        const countryMatch = allCountries.find(
          c => c.name.toLowerCase() === countryName.toLowerCase()
        );
        if (countryMatch) {
          countryCode = countryMatch.isoCode;
        }

        // Parse date
        let shipmentDate: Date;
        if (dateValue instanceof Date) {
          shipmentDate = dateValue;
        } else if (typeof dateValue === 'number') {
          // Excel date serial number (days since 1900-01-01)
          const excelEpoch = new Date(1899, 11, 30); // Excel epoch is Dec 30, 1899
          shipmentDate = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        } else {
          // Try parsing as string date
          const dateStr = String(dateValue).trim();
          shipmentDate = new Date(dateStr);
        }

        if (isNaN(shipmentDate.getTime())) {
          errors.push(`Row ${i + 1}: Invalid date format - ${dateValue}`);
          continue;
        }

        shipmentsData.push({
          trackingId,
          senderName,
          receiverName,
          countryCode,
          countryName,
          shippingMode,
          type,
          vendorName,
          serviceMode,
          status,
          pcs,
          description,
          weight,
          vendorWeight,
          price,
          cos,
          shipmentDate,
        });
      } catch (error: any) {
        errors.push(`Row ${i + 1}: ${error.message || "Error parsing row"}`);
      }
    }

    if (shipmentsData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid shipment data found in Excel file.",
          errors,
        },
        { status: 400 }
      );
    }

    // Process shipments
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const shipmentData of shipmentsData) {
      try {
        // Check if tracking ID already exists
        const existingShipment = await prisma.shipment.findUnique({
          where: { trackingId: shipmentData.trackingId }
        });

        if (existingShipment) {
          results.skipped++;
          results.errors.push(`Tracking ID ${shipmentData.trackingId} already exists`);
          continue;
        }

        // Find or create customer
        let customer = await prisma.customers.findFirst({
          where: { CompanyName: shipmentData.senderName }
        });

        if (!customer) {
          // Get next customer ID
          const maxCustomer = await prisma.customers.findFirst({
            orderBy: { id: 'desc' }
          });
          const nextCustomerId = maxCustomer ? maxCustomer.id + 1 : 1000;

          try {
            customer = await prisma.customers.create({
              data: {
                id: nextCustomerId,
                CompanyName: shipmentData.senderName,
                PersonName: shipmentData.senderName,
                Email: "",
                Phone: "",
                DocumentType: "",
                DocumentNumber: "",
                Country: "Pakistan",
                State: "",
                City: "",
                Zip: "",
                Address: "",
                ActiveStatus: "Active",
                FilePath: "",
                currentBalance: 0,
              }
            });
          } catch (error: any) {
            // If ID conflict, try with auto-increment
            if (error.code === 'P2002') {
              customer = await prisma.customers.create({
                data: {
                  CompanyName: shipmentData.senderName,
                  PersonName: shipmentData.senderName,
                  Email: "",
                  Phone: "",
                  DocumentType: "",
                  DocumentNumber: "",
                  Country: "Pakistan",
                  State: "",
                  City: "",
                  Zip: "",
                  Address: "",
                  ActiveStatus: "Active",
                  FilePath: "",
                  currentBalance: 0,
                }
              });
            } else {
              throw error;
            }
          }
        }

        // Find or create recipient
        let recipient = await prisma.recipients.findFirst({
          where: { CompanyName: shipmentData.receiverName }
        });

        if (!recipient) {
          recipient = await prisma.recipients.create({
            data: {
              CompanyName: shipmentData.receiverName,
              PersonName: shipmentData.receiverName,
              Email: "",
              Phone: "",
              Country: shipmentData.countryCode,
              State: "",
              City: "",
              Zip: "",
              Address: "",
            }
          });
        }

        // Find or create vendor
        let vendor = await prisma.vendors.findFirst({
          where: { CompanyName: shipmentData.vendorName }
        });

        if (!vendor) {
          vendor = await prisma.vendors.create({
            data: {
              CompanyName: shipmentData.vendorName,
              PersonName: shipmentData.vendorName,
              Email: "",
              Phone: "",
              Country: "Pakistan",
              State: "",
              City: "",
              Zip: "",
              Address: "",
              currentBalance: 0,
            }
          });
        }

        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(prisma);
        const vendorInvoiceNumber = generateVendorInvoiceNumber(invoiceNumber);

        // Calculate pricing
        const originalPrice = shipmentData.price;
        const customerTotalCost = Math.round(originalPrice);
        const vendorTotalCost = shipmentData.cos > 0 ? Math.round(shipmentData.cos) : Math.round(originalPrice * 0.8); // Default 80% if no CoS

        // Create shipment
        const shipment = await prisma.shipment.create({
          data: {
            trackingId: shipmentData.trackingId,
            invoiceNumber,
            referenceNumber: "", // Required field
            shipmentDate: shipmentData.shipmentDate,
            agency: "PSS", // Default
            office: "LHE", // Default
            senderName: shipmentData.senderName,
            senderAddress: shipmentData.senderName,
            recipientName: shipmentData.receiverName,
            recipientAddress: shipmentData.receiverName,
            destination: shipmentData.countryCode,
            deliveryStatus: shipmentData.status,
            shippingMode: shipmentData.shippingMode,
            packaging: shipmentData.type,
            vendor: shipmentData.vendorName,
            serviceMode: shipmentData.serviceMode,
            amount: shipmentData.pcs,
            packageDescription: shipmentData.description,
            weight: shipmentData.weight,
            weightVol: shipmentData.weight,
            price: originalPrice,
            totalCost: customerTotalCost,
            subtotal: originalPrice,
            invoiceStatus: "Unpaid",
            totalPackages: shipmentData.pcs,
            totalWeight: shipmentData.weight,
            totalWeightVol: shipmentData.weight,
            manualRate: shipmentData.cos > 0,
          }
        });

        // Get customer and vendor balances
        const customerBalance = customer.currentBalance || 0;
        const vendorBalance = vendor.currentBalance || 0;

        // Calculate invoice status
        let customerRemainingAmount = customerTotalCost;
        let customerAppliedBalance = 0;
        let customerInvoiceStatus = "Unpaid";

        if (customerBalance > 0) {
          customerRemainingAmount = Math.max(0, customerTotalCost - customerBalance);
          customerAppliedBalance = Math.min(customerBalance, customerTotalCost);
          customerInvoiceStatus = customerRemainingAmount === 0 ? "Paid" : "Partial";
        }

        let vendorRemainingAmount = vendorTotalCost;
        let vendorAppliedBalance = 0;
        let vendorInvoiceStatus = "Unpaid";

        if (vendorBalance < 0) {
          vendorAppliedBalance = Math.min(Math.abs(vendorBalance), vendorTotalCost);
          vendorRemainingAmount = Math.max(0, vendorTotalCost - vendorAppliedBalance);
          vendorInvoiceStatus = vendorRemainingAmount === 0 ? "Paid" : "Partial";
        }

        // Create customer invoice
        const customerInvoiceResponse = await fetch(`${req.nextUrl.origin}/api/accounts/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceNumber,
            invoiceDate: shipmentData.shipmentDate.toISOString(),
            trackingNumber: shipmentData.trackingId,
            destination: shipmentData.countryCode,
            weight: shipmentData.weight,
            profile: "Customer",
            fscCharges: 0,
            discount: 0,
            lineItems: [{ description: shipmentData.description || "Shipping Service", value: Math.round(originalPrice) }],
            customerId: customer.id,
            vendorId: null,
            shipmentId: shipment.id,
            disclaimer: "Thank you for your business",
            totalAmount: customerTotalCost,
            currency: "PKR",
            status: customerInvoiceStatus
          })
        });

        // Create vendor invoice
        const vendorInvoiceResponse = await fetch(`${req.nextUrl.origin}/api/accounts/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceNumber: vendorInvoiceNumber,
            invoiceDate: shipmentData.shipmentDate.toISOString(),
            trackingNumber: shipmentData.trackingId,
            destination: shipmentData.countryCode,
            weight: shipmentData.weight,
            profile: "Vendor",
            fscCharges: 0,
            discount: 0,
            lineItems: [{ description: "Vendor Service", value: Math.round(vendorTotalCost) }],
            customerId: null,
            vendorId: vendor.id,
            shipmentId: shipment.id,
            disclaimer: "Vendor invoice",
            totalAmount: vendorTotalCost,
            currency: "PKR",
            status: vendorInvoiceStatus
          })
        });

        // Create customer transaction
        if (customerRemainingAmount > 0) {
          await addCustomerTransaction(
            prisma,
            customer.id,
            'DEBIT',
            customerRemainingAmount,
            `Tracking: ${shipmentData.trackingId} | Country: ${shipmentData.countryCode} | Type: ${shipmentData.type} | Weight: ${shipmentData.weight}Kg`,
            invoiceNumber,
            invoiceNumber,
            shipmentData.shipmentDate
          );

          await createJournalEntryForTransaction(
            prisma,
            'CUSTOMER_DEBIT',
            customerRemainingAmount,
            `Customer invoice for shipment ${shipmentData.trackingId}`,
            invoiceNumber,
            invoiceNumber,
            shipmentData.shipmentDate
          );
        }

        // Create vendor transaction
        if (vendorRemainingAmount > 0) {
          await addVendorTransaction(
            prisma,
            vendor.id,
            'DEBIT',
            vendorRemainingAmount,
            `Tracking: ${shipmentData.trackingId} | Country: ${shipmentData.countryCode} | Type: ${shipmentData.type} | Weight: ${shipmentData.weight}Kg`,
            vendorInvoiceNumber,
            vendorInvoiceNumber,
            shipmentData.shipmentDate
          );

          await createJournalEntryForTransaction(
            prisma,
            'VENDOR_DEBIT',
            vendorRemainingAmount,
            `Vendor invoice for shipment ${shipmentData.trackingId}`,
            vendorInvoiceNumber,
            vendorInvoiceNumber,
            shipmentData.shipmentDate
          );
        }

        // Handle balance application for customer
        if (customerAppliedBalance > 0) {
          await prisma.payment.create({
            data: {
              transactionType: "INCOME",
              category: "Balance Applied",
              date: shipmentData.shipmentDate,
              amount: customerAppliedBalance,
              fromPartyType: "CUSTOMER",
              fromCustomerId: customer.id,
              fromCustomer: shipmentData.senderName,
              toPartyType: "US",
              toVendorId: null,
              toVendor: "",
              mode: "CASH",
              reference: invoiceNumber,
              invoice: invoiceNumber,
              description: `Credit applied for invoice ${invoiceNumber}`
            }
          });

          await addCustomerTransaction(
            prisma,
            customer.id,
            'DEBIT',
            customerAppliedBalance,
            `Credit applied for invoice ${invoiceNumber}`,
            `CREDIT-${invoiceNumber}`,
            invoiceNumber,
            shipmentData.shipmentDate
          );

          await createJournalEntryForTransaction(
            prisma,
            'CUSTOMER_CREDIT',
            customerAppliedBalance,
            `Customer credit applied for invoice ${invoiceNumber}`,
            `CREDIT-${invoiceNumber}`,
            invoiceNumber,
            shipmentData.shipmentDate
          );
        }

        // Handle balance application for vendor
        if (vendorAppliedBalance > 0) {
          await prisma.payment.create({
            data: {
              transactionType: "EXPENSE",
              category: "Balance Applied",
              date: shipmentData.shipmentDate,
              amount: vendorAppliedBalance,
              fromPartyType: "US",
              fromCustomerId: null,
              fromCustomer: "",
              toPartyType: "VENDOR",
              toVendorId: vendor.id,
              toVendor: shipmentData.vendorName,
              mode: "CASH",
              reference: vendorInvoiceNumber,
              invoice: vendorInvoiceNumber,
              description: `Credit applied for vendor invoice ${vendorInvoiceNumber}`
            }
          });

          await addVendorTransaction(
            prisma,
            vendor.id,
            'CREDIT',
            vendorAppliedBalance,
            `Credit applied for vendor invoice ${vendorInvoiceNumber}`,
            `CREDIT-${vendorInvoiceNumber}`,
            vendorInvoiceNumber,
            shipmentData.shipmentDate
          );

          await createJournalEntryForTransaction(
            prisma,
            'VENDOR_CREDIT',
            vendorAppliedBalance,
            `Vendor credit applied for invoice ${vendorInvoiceNumber}`,
            `CREDIT-${vendorInvoiceNumber}`,
            vendorInvoiceNumber,
            shipmentData.shipmentDate
          );
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Tracking ${shipmentData.trackingId}: ${error.message || "Unknown error"}`);
        console.error(`Error processing shipment ${shipmentData.trackingId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.success} shipments successfully. ${results.failed} failed, ${results.skipped} skipped.`,
      results: {
        success: results.success,
        failed: results.failed,
        skipped: results.skipped,
        errors: results.errors.slice(0, 50), // Limit errors to first 50
      }
    });
  } catch (error: any) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process bulk upload",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
