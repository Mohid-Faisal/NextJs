import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber, generateVendorInvoiceNumber, addCustomerTransaction, addVendorTransaction, createJournalEntryForTransaction } from "@/lib/server/ledger";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { checkShipmentLimit } from "@/lib/billing/usage";
import { withUniqueRetry } from "@/lib/withUniqueRetry";

/**
 * POST /api/add-shipment
 * Creates a new shipment with associated invoices and financial transactions
 * 
 * This endpoint handles:
 * 1. Shipment creation with all package and pricing details
 * 2. Customer and vendor invoice generation
 * 3. Financial transaction recording
 * 4. Balance calculations and applications
 * 5. Journal entry creation for accounting
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "create_shipment");
    if (auth.error) return auth.error;
    const session = auth.session;

    // Forward the caller's auth to internal invoice API calls so they share
    // the same org-scoped session (server-side fetch does not carry cookies).
    const incomingAuth = req.headers.get("authorization");
    const incomingCookie = req.headers.get("cookie");
    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (incomingAuth) forwardHeaders["authorization"] = incomingAuth;
    if (incomingCookie) forwardHeaders["cookie"] = incomingCookie;

    // Plan limit / billing gate: block new shipments when the org is over its
    // monthly quota, trial-expired, or past due.
    const limit = await checkShipmentLimit(session.organizationId);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "limit_exceeded",
          reason: limit.reason,
          message: limit.message,
          limit: limit.limit,
          used: limit.used,
          planCode: limit.planCode,
        },
        { status: 402 }
      );
    }

    if (session.email === "demo@psswe.com") {
      const demoCount = await prisma.shipment.count({
        where: { organizationId: session.organizationId },
      });
      if (demoCount >= 15) {
        return NextResponse.json(
          {
            success: false,
            error: "limit_exceeded",
            message: "Demo shipment creation limit reached (max 15). Please start a 14-Day Free Trial for unlimited shipments!",
          },
          { status: 403 }
        );
      }
    }

    // ============================================================================
    // SECTION 1: REQUEST DATA EXTRACTION
    // ============================================================================
    const requestBody = await req.json();
    
    // Extract all required fields from the request body
    const {
      trackingId,
      referenceNumber,
      shipmentDate,
      agency,
      office,
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      destination,
      deliveryTime,
      invoiceStatus,
      deliveryStatus,
      shippingMode,
      packaging,
      vendor,
      serviceMode,
      amount,
      packageDescription,
      weight,
      length,
      width,
      height,
      weightVol,
      fixedCharge,
      decValue,
      price,
      discount,
      fuelSurcharge,
      insurance,
      customs,
      tax,
      declaredValue,
      reissue,
      profitPercentage,
      cos, // Cost of Service - only used in manual mode
      manualRate,
      packages,
      packageTotals,
      calculatedValues,
      totalPackages,
      totalWeight,
      totalWeightVol,
      vendorPrice,
    } = requestBody;
    
    // Handle nested data structure from frontend
    const finalSenderName = senderName || requestBody.selectedSender?.Company || "";
    const finalSenderAddress = senderAddress || requestBody.selectedSender?.Address || "";
    const finalRecipientName = recipientName || requestBody.selectedRecipient?.Company || "";
    const finalRecipientAddress = recipientAddress || requestBody.selectedRecipient?.Address || "";
    const finalDestination = destination || requestBody.selectedRecipient?.Country || "";
    
    console.log('Data extraction debug:', {
      original: { senderName, senderAddress, recipientName, recipientAddress, destination },
      nested: { 
        selectedSender: requestBody.selectedSender, 
        selectedRecipient: requestBody.selectedRecipient 
      },
      final: { finalSenderName, finalSenderAddress, finalRecipientName, finalRecipientAddress, finalDestination }
    });
    
    // ============================================================================
    // SECTION 2: VALIDATION
    // ============================================================================
    // Validate required fields
    if (!trackingId) {
      return NextResponse.json(
        { error: "Tracking ID is required" },
        { status: 400 }
      );
    }

    // Check if tracking ID already exists
    const existingTrackingId = await prisma.shipment.findFirst({
      where: orgWhere(session, { trackingId }),
    });
    if (existingTrackingId) {
      return NextResponse.json(
        { error: "Tracking ID already exists" },
        { status: 400 }
      );
    }

    // Check if reference number already exists (only if provided)
    if (referenceNumber && referenceNumber.trim() !== '') {
      const existingReferenceNumber = await prisma.shipment.findFirst({
        where: orgWhere(session, { referenceNumber }),
      });
      if (existingReferenceNumber) {
        return NextResponse.json(
          { error: "Reference Number already exists" },
          { status: 400 }
        );
      }
    }

    // ============================================================================
    // SECTION 3: DEBUG LOGGING
    // ============================================================================
    // Log all received data for debugging purposes
    console.log('=== SHIPMENT DATA RECEIVED ===');
    console.log('Basic Form Data:', {
      trackingId,
      referenceNumber,
      agency,
      office,
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      destination,
      deliveryTime,
      invoiceStatus,
      deliveryStatus,
      shippingMode,
      packaging,
      vendor,
      serviceMode,
      amount,
      packageDescription,
      weight,
      length,
      width,
      height,
      weightVol,
      fixedCharge,
      decValue,
      price,
      discount,
      fuelSurcharge,
      insurance,
      customs,
      tax,
      declaredValue,
      reissue,
      profitPercentage,
      vendorPrice,
      manualRate,
    });
    
    console.log('Tracking Information:', {
      trackingId: trackingId,
    });
    
    console.log('Destination Information:', {
      finalDestination: finalDestination,
    });
    
    console.log('Package Information:', {
      packages: packages,
      packageTotals: packageTotals,
      totalPackages: totalPackages,
      totalWeight: totalWeight,
      totalWeightVol: totalWeightVol,
    });
    
    console.log('Calculated Values:', calculatedValues);
    
    console.log('Additional Metadata:', {
      manualRate: manualRate,
      vendor: vendor,
      serviceMode: serviceMode,
    });
    
    console.log('Complete Request Body:', requestBody);
    console.log('=== END SHIPMENT DATA ===');

        // ============================================================================
    // SECTION 4: INPUT VALIDATION
    // ============================================================================
    // Define required fields for validation
    const requiredFields = [
      "senderName",
      "senderAddress",
      "recipientName",
      "recipientAddress",
      "destination",
    ];

    // Validate destination (required field)
    if (!finalDestination || finalDestination.trim() === '') {
      return NextResponse.json(
        { success: false, message: "Destination is required." },
        { status: 400 }
      );
    }

    // Validate all other required fields
    const fieldValidations = [
      { field: 'senderName', value: finalSenderName },
      { field: 'senderAddress', value: finalSenderAddress },
      { field: 'recipientName', value: finalRecipientName },
      { field: 'recipientAddress', value: finalRecipientAddress },
    ];

    for (const { field, value } of fieldValidations) {
      if (!value || value.trim() === '') {
        return NextResponse.json(
          { success: false, message: `${field} is required.` },
          { status: 400 }
        );
      }
    }

    // ============================================================================
    // SECTION 5: PRICING CALCULATIONS
    // ============================================================================
    // Parse and calculate all pricing components
    const priceWithProfit = Math.round((parseFloat(price) || 0));
    const fuelSurchargeAmount = Math.round((parseFloat(fuelSurcharge) || 0));
    const discountPercentage = parseFloat(discount) || 0;
    const profitPercentageValue = parseFloat(profitPercentage) || 0;
    
    // Calculate original price by removing profit from the price with profit
    // This is needed because the frontend sends price with profit included
    const originalPrice = profitPercentageValue > 0 ? Math.round((priceWithProfit / (1 + profitPercentageValue / 100)) * 100) / 100 : priceWithProfit;
    
    // Calculate discount amount as percentage of original price
    const discountAmount = Math.round(((originalPrice * discountPercentage) / 100));
    
    // Calculate profit amount as percentage of original price
    const profitAmount = Math.round(((originalPrice * profitPercentageValue) / 100));
    
    // Calculate total costs for customer and vendor
    // Customer invoice uses the price with profit (from frontend)
    const customerTotalCost = Math.round((priceWithProfit + fuelSurchargeAmount - discountAmount));
    // Vendor invoice: use CoS (Cost of Service) if in manual mode, otherwise use vendorPrice
    const vendorTotalCost = manualRate 
      ? Math.round((parseFloat(cos) || 0))
      : Math.round((parseFloat(vendorPrice) || 0));

    // Get subtotal from calculated values or use original price
    const subtotal = calculatedValues?.subtotal ? Math.round((calculatedValues.subtotal)) : originalPrice;
    
    // Log pricing calculations for debugging
    console.log('=== PRICING CALCULATIONS ===');
    console.log('Price from request:', price);
    console.log('Fuel surcharge:', fuelSurcharge);
    console.log('Discount percentage:', discount);
    console.log('Profit percentage:', profitPercentage);
    console.log('Manual rate:', manualRate);
    console.log('CoS (Cost of Service):', cos);
    console.log('Vendor price:', vendorPrice);
    console.log('Fixed charge:', fixedCharge);
    console.log('Original price (no profit):', originalPrice);
    console.log('Customer total cost (with profit):', customerTotalCost);
    console.log(`Vendor total cost (${manualRate ? 'CoS' : 'vendorPrice'}):`, vendorTotalCost);
    console.log('=== END PRICING CALCULATIONS ===');

    // ============================================================================
    // SECTION 6: PREPARE INVOICE LINE ITEMS
    // ============================================================================
    const customerLineItems: { description: string; value: number }[] = [];
    let parsedPackages = packages;
    if (typeof packages === "string") {
      try {
        parsedPackages = JSON.parse(packages);
      } catch (e) {
        console.error("Error parsing packages:", e);
        parsedPackages = [];
      }
    }

    if (Array.isArray(parsedPackages) && parsedPackages.length > 0) {
      const totalWeightVal = parsedPackages.reduce(
        (sum: number, pkg: any) => sum + Math.max(pkg.weight || 0, pkg.weightVol || 0),
        0
      );
      parsedPackages.forEach((pkg: any) => {
        const packageWeight = Math.max(pkg.weight || 0, pkg.weightVol || 0);
        const packageProportion =
          totalWeightVal > 0 ? packageWeight / totalWeightVal : 1 / parsedPackages.length;
        const packageValue = Math.round(originalPrice * packageProportion);
        const description = pkg.packageDescription || "Shipping Service";
        customerLineItems.push({ description, value: packageValue });
      });
    } else {
      customerLineItems.push({ description: "Shipping Service", value: Math.round(originalPrice) });
    }

    if (profitPercentageValue > 0) {
      customerLineItems.push({ description: "Profit", value: Math.round(profitAmount) });
    }

    const vendorLineItems: { description: string; value: number }[] = [];
    if (Array.isArray(parsedPackages) && parsedPackages.length > 0) {
      const totalWeightVal = parsedPackages.reduce(
        (sum: number, pkg: any) => sum + Math.max(pkg.weight || 0, pkg.weightVol || 0),
        0
      );
      parsedPackages.forEach((pkg: any) => {
        const packageWeight = Math.max(pkg.weight || 0, pkg.weightVol || 0);
        const packageProportion =
          totalWeightVal > 0 ? packageWeight / totalWeightVal : 1 / parsedPackages.length;
        const packageValue = Math.round(originalPrice * packageProportion);
        const description = pkg.packageDescription || "Vendor Service";
        vendorLineItems.push({ description, value: packageValue });
      });
    } else {
      vendorLineItems.push({ description: "Vendor Service", value: Math.round(originalPrice) });
    }

    // ============================================================================
    // SECTION 7: ATOMIC SHIPMENT & INVOICE CREATION TRANSACTION
    // ============================================================================
    let invoiceNumber = await generateInvoiceNumber(prisma, session.organizationId);

    const txResult = await withUniqueRetry(
      async () => {
        return await prisma.$transaction(
          async (tx) => {
            const vendorInvoiceNumber = generateVendorInvoiceNumber(invoiceNumber);

            // 7.1 Customer and Vendor Lookup
            let customerId: number | null = null;
            let customerBalance = 0;
            if (finalSenderName) {
              const customer = await tx.customers.findFirst({
                where: orgWhere(session, { CompanyName: finalSenderName }),
              });
              customerId = customer?.id || null;
              customerBalance = customer?.currentBalance || 0;
            }

            let vendorId: number | null = null;
            let vendorBalance = 0;
            if (vendor) {
              const vendorRecord = await tx.vendors.findFirst({
                where: orgWhere(session, { CompanyName: vendor }),
              });
              vendorId = vendorRecord?.id || null;
              vendorBalance = vendorRecord?.currentBalance || 0;
            }

            // 7.2 Customer Balance Calculations
            let appliedBalance = 0;
            let remainingAmount = 0;
            let calculatedInvoiceStatus = "Unpaid";
            if (customerBalance > 0) {
              remainingAmount = Math.max(0, customerTotalCost - customerBalance);
              appliedBalance = Math.min(customerBalance, customerTotalCost);
            } else {
              remainingAmount = customerTotalCost;
              appliedBalance = 0;
            }

            if (remainingAmount === 0) {
              calculatedInvoiceStatus = "Paid";
            } else if (appliedBalance > 0) {
              calculatedInvoiceStatus = "Partial";
            }

            // 7.3 Vendor Balance Calculations
            let vendorAppliedBalance = 0;
            let vendorRemainingAmount = 0;
            let vendorCalculatedInvoiceStatus = "Unpaid";
            if (vendorBalance > 0) {
              vendorRemainingAmount = vendorTotalCost;
              vendorAppliedBalance = 0;
            } else {
              vendorAppliedBalance = Math.min(Math.abs(vendorBalance), vendorTotalCost);
              vendorRemainingAmount = Math.max(0, vendorTotalCost - vendorAppliedBalance);
            }

            if (vendorRemainingAmount === 0) {
              vendorCalculatedInvoiceStatus = "Paid";
            } else if (vendorAppliedBalance > 0) {
              vendorCalculatedInvoiceStatus = "Partial";
            }

            // 7.4 Create Shipment Record
            const shipmentDateObj = shipmentDate ? new Date(shipmentDate) : new Date();
            const bookingDateTime = new Date(shipmentDateObj.getTime() - 2.5 * 60 * 60 * 1000);
            const initialTrackingHistory = [
              { status: "Booked", timestamp: bookingDateTime.toISOString(), location: "Lahore, Pakistan" },
              { status: "Picked Up", timestamp: shipmentDateObj.toISOString(), location: "Lahore, Pakistan" },
            ];

            const shipment = await tx.shipment.create({
              data: orgData(session, {
                trackingId,
                referenceNumber: referenceNumber ? referenceNumber.trim() : "",
                invoiceNumber,
                shipmentDate: shipmentDateObj,
                agency,
                office,
                senderName: finalSenderName,
                senderAddress: finalSenderAddress,
                recipientName: finalRecipientName,
                recipientAddress: finalRecipientAddress,
                destination: finalDestination,
                deliveryTime,
                invoiceStatus: calculatedInvoiceStatus,
                deliveryStatus,
                shippingMode,
                packaging,
                vendor,
                serviceMode,
                amount: parseInt(amount) || 1,
                packageDescription,
                weight: parseFloat(weight) || 0,
                length: parseFloat(length) || 0,
                width: parseFloat(width) || 0,
                height: parseFloat(height) || 0,
                weightVol: parseFloat(weightVol) || 0,
                fixedCharge: parseFloat(fixedCharge) || 0,
                decValue: parseFloat(decValue) || 0,
                price: originalPrice,
                discount: discountPercentage,
                fuelSurcharge: fuelSurchargeAmount,
                insurance: parseFloat(insurance) || 0,
                customs: parseFloat(customs) || 0,
                tax: parseFloat(tax) || 0,
                declaredValue: parseFloat(declaredValue) || 0,
                reissue: parseFloat(reissue) || 0,
                profitPercentage: profitPercentageValue,
                cos: parseFloat(cos) || 0,
                totalCost: customerTotalCost,
                subtotal,
                manualRate: Boolean(manualRate),
                totalPackages: parseInt(totalPackages) || 0,
                totalWeight: parseFloat(totalWeight) || 0,
                totalWeightVol: parseFloat(totalWeightVol) || 0,
                packages: packages ? JSON.stringify(packages) : undefined,
                packageTotals: packageTotals ? JSON.stringify(packageTotals) : undefined,
                calculatedValues: calculatedValues ? JSON.stringify(calculatedValues) : undefined,
                trackingStatusHistory: initialTrackingHistory as unknown as object,
                trackingStatus: "Picked Up",
              }) as any,
            });

            // 7.5 Create Customer Invoice
            const finalCustomerLineItems = [...customerLineItems];
            if (appliedBalance > 0) {
              finalCustomerLineItems.push({
                description: "Balance Applied",
                value: Math.round(-appliedBalance),
              });
            }

            const customerInvoice = await tx.invoice.create({
              data: orgData(session, {
                invoiceNumber,
                invoiceDate: shipmentDateObj,
                trackingNumber: trackingId,
                destination: finalDestination,
                weight: parseFloat(totalWeight) || 0,
                profile: "Customer",
                fscCharges: Math.round(fuelSurchargeAmount),
                discount: Math.round(discountAmount),
                lineItems: finalCustomerLineItems,
                customerId,
                vendorId: null,
                shipmentId: shipment.id,
                disclaimer: "Thank you for your business",
                totalAmount: customerTotalCost,
                currency: "PKR",
                status: calculatedInvoiceStatus,
              }),
            });

            // 7.6 Create Vendor Invoice
            const finalVendorLineItems = [...vendorLineItems];
            if (vendorAppliedBalance > 0) {
              finalVendorLineItems.push({
                description: "Balance Applied",
                value: Math.round(-vendorAppliedBalance),
              });
            }

            const vendorInvoice = await tx.invoice.create({
              data: orgData(session, {
                invoiceNumber: vendorInvoiceNumber,
                invoiceDate: shipmentDateObj,
                trackingNumber: trackingId,
                destination: finalDestination,
                weight: parseFloat(totalWeight) || 0,
                profile: "Vendor",
                fscCharges: 0,
                discount: Math.round(discountAmount),
                lineItems: finalVendorLineItems,
                customerId: null,
                vendorId,
                shipmentId: shipment.id,
                disclaimer: "Vendor invoice - original cost without profit",
                totalAmount: vendorTotalCost,
                currency: "PKR",
                status: vendorCalculatedInvoiceStatus,
              }),
            });

            // 7.7 Record Customer Transactions & Journal Entries
            if (customerId && remainingAmount >= 0) {
              await addCustomerTransaction(
                tx,
                customerId,
                "DEBIT",
                remainingAmount,
                `Tracking: ${trackingId} | Country: ${finalDestination} | Type: ${packaging} | Weight: ${totalWeight}Kg`,
                invoiceNumber,
                invoiceNumber,
                shipmentDateObj,
                session.organizationId
              );
            }

            const customerRevenueAmount =
              (customerInvoice?.totalAmount > 0
                ? customerInvoice.totalAmount
                : null) ??
              (customerTotalCost > 0 ? customerTotalCost : remainingAmount);
            if (customerRevenueAmount > 0) {
              await createJournalEntryForTransaction(
                tx,
                "CUSTOMER_DEBIT",
                customerRevenueAmount,
                `Customer invoice for shipment ${trackingId}`,
                invoiceNumber,
                invoiceNumber,
                shipmentDateObj,
                session.organizationId
              );
            }

            if (appliedBalance > 0 && customerId) {
              await addCustomerTransaction(
                tx,
                customerId,
                "CREDIT",
                appliedBalance,
                `Balance applied for invoice ${invoiceNumber}`,
                `CREDIT-${invoiceNumber}`,
                invoiceNumber,
                shipmentDateObj,
                session.organizationId
              );
              await createJournalEntryForTransaction(
                tx,
                "CUSTOMER_CREDIT",
                appliedBalance,
                `Customer credit applied for invoice ${invoiceNumber}`,
                `CREDIT-${invoiceNumber}`,
                invoiceNumber,
                shipmentDateObj,
                session.organizationId
              );
            }

            // 7.8 Record Vendor Transactions & Journal Entries
            if (vendorId && vendorRemainingAmount >= 0) {
              await addVendorTransaction(
                tx,
                vendorId,
                "DEBIT",
                vendorRemainingAmount,
                `Tracking: ${trackingId} | Country: ${finalDestination} | Type: ${packaging} | Weight: ${totalWeight}Kg`,
                vendorInvoiceNumber,
                vendorInvoiceNumber,
                shipmentDateObj,
                session.organizationId
              );
            }

            const vendorExpenseAmount =
              (vendorInvoice?.totalAmount > 0
                ? vendorInvoice.totalAmount
                : null) ??
              (vendorTotalCost > 0 ? vendorTotalCost : vendorRemainingAmount);
            if (vendorExpenseAmount > 0) {
              await createJournalEntryForTransaction(
                tx,
                "VENDOR_DEBIT",
                vendorExpenseAmount,
                `Vendor invoice for shipment ${trackingId}`,
                vendorInvoiceNumber,
                vendorInvoiceNumber,
                shipmentDateObj,
                session.organizationId
              );
            }

            if (vendorAppliedBalance > 0 && vendorId) {
              await addVendorTransaction(
                tx,
                vendorId,
                "CREDIT",
                vendorAppliedBalance,
                `Balance applied for vendor invoice ${vendorInvoiceNumber}`,
                `CREDIT-${vendorInvoiceNumber}`,
                vendorInvoiceNumber,
                shipmentDateObj,
                session.organizationId
              );
              await createJournalEntryForTransaction(
                tx,
                "VENDOR_CREDIT",
                vendorAppliedBalance,
                `Vendor credit applied for invoice ${vendorInvoiceNumber}`,
                `CREDIT-${vendorInvoiceNumber}`,
                vendorInvoiceNumber,
                shipmentDateObj,
                session.organizationId
              );
            }

            return {
              shipment,
              customerInvoice,
              vendorInvoice,
              customerBalance,
              appliedBalance,
              remainingAmount,
              calculatedInvoiceStatus,
              vendorBalance,
              vendorAppliedBalance,
              vendorRemainingAmount,
              vendorCalculatedInvoiceStatus,
              invoiceNumber,
            };
          },
          { timeout: 30000 }
        );
      },
      {
        retries: 2,
        onRetry: async () => {
          console.warn("add-shipment: invoice number collision detected, regenerating");
          invoiceNumber = await generateInvoiceNumber(prisma, session.organizationId);
        },
      }
    );

    const {
      shipment,
      customerInvoice,
      vendorInvoice,
      customerBalance,
      appliedBalance,
      remainingAmount,
      calculatedInvoiceStatus,
      vendorBalance,
      vendorAppliedBalance,
      vendorRemainingAmount,
      vendorCalculatedInvoiceStatus,
    } = txResult;

    // ============================================================================
    // SECTION 9: RESPONSE
    // ============================================================================
    // Return success response with all created data
    return NextResponse.json({
      success: true,
      message: "Shipment added successfully.",
      shipment,
      invoices: {
        customer: customerInvoice,
        vendor: vendorInvoice
      },
      calculation: {
        originalPrice,
        priceWithProfit,
        fuelSurcharge: fuelSurchargeAmount,
        discountPercentage: discountPercentage,
        discountAmount: discountAmount,
        profitPercentage: profitPercentageValue,
        profitAmount: profitAmount,
        customerTotalCost,
        vendorTotalCost,
        subtotal,
        customerBalance: customerBalance,
        appliedBalance: appliedBalance,
        remainingAmount: remainingAmount,
        invoiceStatus: calculatedInvoiceStatus,
        vendorBalance: vendorBalance,
        vendorAppliedBalance: vendorAppliedBalance,
        vendorRemainingAmount: vendorRemainingAmount,
        vendorInvoiceStatus: vendorCalculatedInvoiceStatus,
      },
      receivedData: {
        trackingId: trackingId,
        invoiceNumber: invoiceNumber,
        destination: finalDestination,
        totalPackages: totalPackages,
        totalWeight: totalWeight,
        totalWeightVol: totalWeightVol,
        calculatedValues: calculatedValues,
      },
    });
  } catch (error: any) {
    console.error("Add shipment error:", error);
    if (error?.code === "P2002") {
      const target = Array.isArray(error?.meta?.target)
        ? error?.meta?.target.join(",")
        : String(error?.meta?.target || "");
      if (target.includes("trackingId")) {
        return NextResponse.json(
          { success: false, error: "Tracking ID already exists. Please enter a unique Tracking ID." },
          { status: 409 }
        );
      }
      if (target.includes("referenceNumber")) {
        return NextResponse.json(
          { success: false, error: "Reference Number already exists. Please enter a unique Reference Number." },
          { status: 409 }
        );
      }
      if (target.includes("invoiceNumber")) {
        return NextResponse.json(
          { success: false, error: "Invoice number collision detected. Please try submitting again." },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to add shipment." },
      { status: 500 }
    );
  }
}
