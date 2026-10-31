import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { parseDateInputAsLocalDate } from "@/lib/noteFormats";
import {
  addCustomerTransaction,
  addVendorTransaction,
  buildShipmentDebitTransactionLineDescription,
  createJournalEntryForTransaction,
  syncShipmentInvoiceDebitTransactionDescriptions,
  updateInvoiceBalance,
  updateJournalEntriesForInvoice,
  lookupVendorRate,
} from "@/lib/server/ledger";

// Function to update existing journal entries for transactions
async function updateJournalEntryForTransaction(
  tx: any,
  type: 'CUSTOMER_DEBIT' | 'CUSTOMER_CREDIT' | 'VENDOR_DEBIT' | 'VENDOR_CREDIT',
  amount: number,
  description: string,
  reference?: string,
  invoice?: string,
  organizationId?: number
) {
  try {
    const orgFilter = organizationId != null ? { organizationId } : {};
    console.log(`Searching for journal entry with reference: ${reference}, invoice: ${invoice}`);
    
    const cleanRef = typeof reference === "string" ? reference.trim() : "";
    const cleanInvoice = typeof invoice === "string" ? invoice.trim() : "";
    const isValidInvoice = cleanInvoice.length >= 3 && !/^[.\-_/ ]+$/.test(cleanInvoice);

    let existingJournalEntry = null;

    if (cleanRef) {
      existingJournalEntry = await tx.journalEntry.findFirst({
        where: {
          ...orgFilter,
          reference: cleanRef
        },
        include: {
          lines: true
        }
      });
    }
    
    // If not found by reference, try by invoice number as reference or CREDIT-invoice
    if (!existingJournalEntry && isValidInvoice) {
      existingJournalEntry = await tx.journalEntry.findFirst({
        where: {
          ...orgFilter,
          reference: { in: [cleanInvoice, `CREDIT-${cleanInvoice}`] }
        },
        include: {
          lines: true
        }
      });
    }

    if (existingJournalEntry) {
      console.log(`Found existing journal entry ${existingJournalEntry.entryNumber} for invoice ${invoice}`);
      
      // Update the existing journal entry
      await tx.journalEntry.update({
        where: { id: existingJournalEntry.id },
        data: {
          description: description,
          totalDebit: amount,
          totalCredit: amount,
          updatedAt: new Date()
        }
      });

      // Update journal entry lines with new amounts
      if (existingJournalEntry.lines && existingJournalEntry.lines.length > 0) {
        console.log(`Found ${existingJournalEntry.lines.length} journal entry lines to update`);
        
        for (const line of existingJournalEntry.lines) {
          console.log(`Updating line ${line.id}: debitAmount=${line.debitAmount}, creditAmount=${line.creditAmount}`);
          
          if (line.debitAmount > 0) {
            // This is a debit line, update it
            await tx.journalEntryLine.update({
              where: { id: line.id },
              data: {
                debitAmount: amount,
                description: `Updated: ${description}`
              }
            });
            console.log(`Updated debit line ${line.id} to amount ${amount}`);
          } else if (line.creditAmount > 0) {
            // This is a credit line, update it
            await tx.journalEntryLine.update({
              where: { id: line.id },
              data: {
                creditAmount: amount,
                description: `Updated: ${description}`
              }
            });
            console.log(`Updated credit line ${line.id} to amount ${amount}`);
          }
        }
      } else {
        console.log(`No journal entry lines found to update`);
      }
      
      console.log(`Updated journal entry ${existingJournalEntry.entryNumber} for ${type} with amount ${amount}`);
    } else {
      // If no existing journal entry found, create a new one
      console.log(`No existing journal entry found for invoice ${invoice}, creating new one`);
      await createJournalEntryForTransaction(
        tx,
        type,
        amount,
        description,
        reference,
        invoice,
        undefined,
        organizationId
      );
    }
  } catch (error) {
    console.error(`Error updating journal entry for ${type}:`, error);
    // Don't throw error, just log it to avoid breaking the main transaction
  }
}

// Function to update customer balance
async function updateCustomerBalance(tx: any, customerId: number, oldAmount: number, newAmount: number) {
  try {
    // Get current customer
    const customer = await tx.customers.findUnique({
      where: { id: customerId }
    });

    if (customer) {
      console.log(`Current customer ${customerId} balance: ${customer.currentBalance}`);
      
      // Calculate balance adjustment: remove old amount, add new amount
      const balanceAdjustment = (Number(newAmount) || 0) - (Number(oldAmount) || 0);
      const newBalance = (Number(customer.currentBalance) || 0) - balanceAdjustment;

      console.log(`Balance calculation: ${customer.currentBalance} - (${newAmount} - ${oldAmount}) = ${newBalance}`);

      // Update customer balance
      await tx.customers.update({
        where: { id: customerId },
        data: {
          currentBalance: newBalance
        }
      });

      console.log(`Updated customer ${customerId} balance: ${customer.currentBalance} → ${newBalance} (adjustment: ${balanceAdjustment})`);
    } else {
      console.log(`Customer ${customerId} not found for balance update`);
    }
  } catch (error) {
    console.error(`Error updating customer balance for customer ${customerId}:`, error);
  }
}

// Function to update vendor balance
async function updateVendorBalance(tx: any, vendorId: number, oldAmount: number, newAmount: number) {
  try {
    // Get current vendor
    const vendor = await tx.vendors.findUnique({
      where: { id: vendorId }
    });

    if (vendor) {
      console.log(`Current vendor ${vendorId} balance: ${vendor.currentBalance}`);
      
      // Calculate balance adjustment: remove old amount, add new amount
      const balanceAdjustment = (Number(newAmount) || 0) - (Number(oldAmount) || 0);
      const newBalance = (Number(vendor.currentBalance) || 0) + balanceAdjustment;

      console.log(`Balance calculation: ${vendor.currentBalance} + (${newAmount} - ${oldAmount}) = ${newBalance}`);

      // Update vendor balance
      await tx.vendors.update({
        where: { id: vendorId },
        data: {
          currentBalance: newBalance
        }
      });

      console.log(`Updated vendor ${vendorId} balance: ${vendor.currentBalance} → ${newBalance} (adjustment: ${balanceAdjustment})`);
    } else {
      console.log(`Vendor ${vendorId} not found for balance update`);
    }
  } catch (error) {
    console.error(`Error updating vendor balance for vendor ${vendorId}:`, error);
  }
}

export async function PUT(req: Request) {
  return handleShipmentUpdate(req);
}

export async function PATCH(req: Request) {
  return handleShipmentUpdate(req);
}

async function handleShipmentUpdate(req: Request) {
  try {
    const auth = await requirePermission(req as import("next/server").NextRequest, "edit_shipment");
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json();
    
    // Console log the received data for debugging
    console.log('=== UPDATE SHIPMENT DATA RECEIVED ===');
    console.log('Complete Request Body:', body);
    console.log('Key Fields:', {
      deliveryStatus: body.deliveryStatus,
      packaging: body.packaging,
      shippingMode: body.shippingMode,
      vendor: body.vendor,
      serviceMode: body.serviceMode,
      referenceNumber: body.referenceNumber,
      cos: body.cos,
    });
    console.log('=== END UPDATE SHIPMENT DATA ===');
    
    const {
      id,
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
      manualRate,
      cos, // Cost of Service - only used in manual mode
      packages,
      packageTotals,
      calculatedValues,
      totalPackages,
      totalWeight,
      totalWeightVol,
      totalCost,
      invoiceStatus,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing shipment ID" }, { status: 400 });
    }

    // Fetch existing shipment to use current values when new values aren't provided
    const existingShipment = await prisma.shipment.findFirst({
      where: orgWhere(session, { id }),
      include: { invoices: true },
    });

    if (!existingShipment) {
      return NextResponse.json({ success: false, message: "Shipment not found" }, { status: 404 });
    }

    // Use existing values if new values aren't provided (coerce Prisma.Decimal to Number)
    const existingPriceNum = Number(existingShipment.price) || 0;
    const effectiveFuelSurcharge = fuelSurcharge !== undefined ? parseFloat(fuelSurcharge) : (Number(existingShipment.fuelSurcharge) || 0);
    const effectiveDiscount = discount !== undefined ? parseFloat(discount) : (Number(existingShipment.discount) || 0);
    const effectiveProfitPercentage = profitPercentage !== undefined ? parseFloat(profitPercentage) : (Number(existingShipment.profitPercentage) || 0);
    const effectiveFixedCharge = fixedCharge !== undefined ? parseFloat(fixedCharge) : (Number(existingShipment.fixedCharge) || 0);
    const effectiveTrackingId = trackingId !== undefined ? trackingId : existingShipment.trackingId;
    const effectiveDestination = destination !== undefined ? destination : existingShipment.destination;
    const effectiveTotalWeight = totalWeight !== undefined ? parseFloat(totalWeight) : (Number(existingShipment.totalWeight) || Number(existingShipment.weight) || 0);

    // ============================================================================
    // SECTION: PRICING CALCULATIONS (Same logic as add-shipment)
    // ============================================================================
    const fuelSurchargeAmount = Math.round(effectiveFuelSurcharge || 0);
    const discountPercentage = effectiveDiscount || 0;
    const profitPercentageValue = effectiveProfitPercentage || 0;

    // Note: add-shipment stores `originalPrice` (without profit) in `shipment.price`,
    // while the frontend sends `price` with profit included when `price !== undefined`.
    const priceWithProfit =
      price !== undefined
        ? Math.round(parseFloat(price) || 0)
        : Math.round(existingPriceNum * (1 + profitPercentageValue / 100));
    const originalPrice =
      price !== undefined
        ? profitPercentageValue > 0
          ? Math.round((priceWithProfit / (1 + profitPercentageValue / 100)) * 100) / 100
          : priceWithProfit
        : existingPriceNum;

    // Calculate discount amount as percentage of original price
    const discountAmount = Math.round((originalPrice * discountPercentage) / 100);

    // Calculate profit amount as percentage of original price
    const profitAmount = Math.round((originalPrice * profitPercentageValue) / 100);

    // Customer invoice uses the price with profit (from frontend)
    const customerTotalCost = Math.round(priceWithProfit + fuelSurchargeAmount - discountAmount);

    // Vendor invoice: use CoS (Cost of Service) if in manual mode, otherwise vendorPrice or originalPrice - fixedCharge
    const effectiveManualRate = manualRate !== undefined ? Boolean(manualRate) : Boolean(existingShipment.manualRate);
    const effectiveCos = cos !== undefined ? (parseFloat(String(cos)) || 0) : (Number(existingShipment.cos) || 0);
    let parsedVendorPrice: number | null = null;
    if (body.vendorPrice !== undefined) {
      parsedVendorPrice = parseFloat(String(body.vendorPrice)) || 0;
    } else if (calculatedValues && typeof calculatedValues === "object" && calculatedValues.vendorPrice !== undefined) {
      parsedVendorPrice = parseFloat(String(calculatedValues.vendorPrice)) || 0;
    } else if (existingShipment.calculatedValues) {
      try {
        const existingCalc =
          typeof existingShipment.calculatedValues === "string"
            ? JSON.parse(existingShipment.calculatedValues)
            : (existingShipment.calculatedValues as any);
        if (existingCalc?.vendorPrice !== undefined) {
          parsedVendorPrice = parseFloat(String(existingCalc.vendorPrice)) || 0;
        }
      } catch {
        // ignore
      }
    }

    const existingVendorInvoice = existingShipment.invoices?.find(
      (inv) => inv.profile === "Vendor" || (!inv.profile && inv.vendorId && !inv.customerId)
    );
    const existingVendorInvAmount = Number(existingVendorInvoice?.totalAmount) || 0;
    const existingShipmentCos = Number(existingShipment.cos) || 0;

    let vendorTotalCost = effectiveManualRate
      ? Math.round(
          effectiveCos > 0
            ? effectiveCos
            : (parsedVendorPrice || existingShipmentCos || existingVendorInvAmount || 0)
        )


      : parsedVendorPrice !== null && parsedVendorPrice > 0
        ? Math.round(parsedVendorPrice)
        : Math.round(effectiveCos || existingShipmentCos || existingVendorInvAmount || 0);

    if (vendorTotalCost <= 0) {
      const effVendor = String((vendor !== undefined ? vendor : existingShipment.vendor) ?? "").trim();
      const effService = String((serviceMode !== undefined ? serviceMode : existingShipment.serviceMode) ?? "").trim();
      const effPkg = String((packaging !== undefined ? packaging : existingShipment.packaging) ?? "").trim();
      if (effVendor && effectiveDestination && effectiveTotalWeight > 0) {
        const rateMatch = await lookupVendorRate(prisma, {
          organizationId: session.organizationId,
          vendor: effVendor,
          serviceMode: effService,
          destination: effectiveDestination,
          packaging: effPkg,
          weight: effectiveTotalWeight,
        });
        if (rateMatch && rateMatch.vendorPrice > 0) {
          vendorTotalCost = Math.round(rateMatch.vendorPrice);
        }
      }
    }
    if (vendorTotalCost <= 0 && originalPrice > 0) {
      vendorTotalCost = Math.max(0, Math.round(originalPrice - effectiveFixedCharge));
    }





    const customerPricingChanged =
      price !== undefined ||
      fuelSurcharge !== undefined ||
      discount !== undefined ||
      profitPercentage !== undefined ||
      totalCost !== undefined;
    const vendorPricingChanged =
      (effectiveManualRate && cos !== undefined) ||
      (!effectiveManualRate && (body.vendorPrice !== undefined || price !== undefined));

    // For backward compatibility, also calculate the old format
    let calculatedTotalCost: number;
    if (price !== undefined || fuelSurcharge !== undefined || discount !== undefined || profitPercentage !== undefined) {
      calculatedTotalCost = customerTotalCost;
    } else if (totalCost !== undefined) {
      calculatedTotalCost = parseFloat(totalCost) || 0;
    } else {
      calculatedTotalCost = Number(existingShipment.totalCost) || 0;
    }
    
    // Log pricing calculations for debugging
    console.log('=== PRICING CALCULATIONS ===');
    console.log('Price from request:', price);
    console.log('Fuel surcharge:', fuelSurcharge);
    console.log('Discount percentage:', discount);
    console.log('Profit percentage:', profitPercentage);
    console.log('Original price (no profit):', originalPrice);
    console.log('CoS (Cost of Service):', cos);
    console.log('Manual rate:', effectiveManualRate);
    console.log('Customer total cost (with profit):', customerTotalCost);
    console.log(`Vendor total cost (${effectiveManualRate ? 'CoS' : 'vendorPrice / originalPrice - fixedCharge'}):`, vendorTotalCost);
    console.log('=== END PRICING CALCULATIONS ===');

    const totalWeightChanged =
      totalWeight !== undefined &&
      Math.abs(
        parseFloat(String(totalWeight)) -
          (Number(existingShipment.totalWeight ?? existingShipment.weight) || 0)
      ) > 1e-6;
    const packagingChanged =
      packaging !== undefined && packaging !== (existingShipment.packaging ?? "");
    const referenceChanged =
      referenceNumber !== undefined &&
      String(referenceNumber).trim() !== (existingShipment.referenceNumber ?? "");
    const serviceModeChanged =
      serviceMode !== undefined && serviceMode !== (existingShipment.serviceMode ?? "");
    const shippingModeChanged =
      shippingMode !== undefined && shippingMode !== (existingShipment.shippingMode ?? "");
    const vendorChanged =
      vendor !== undefined && vendor !== (existingShipment.vendor ?? "");
    const packagesChanged = packages !== undefined;

    // Use a transaction to ensure all updates happen together
    const result = await prisma.$transaction(async (tx) => {
      // Resolve vendorId from incoming vendor or existingShipment.vendor so unlinked vendor bills also get linked
      let resolvedVendorId: number | undefined = undefined;
      const effectiveVendorName = String((vendor !== undefined ? vendor : existingShipment.vendor) ?? "").trim();
      if (effectiveVendorName) {
        const vendorRecord = await tx.vendors.findFirst({
          where: orgWhere(session, {
            CompanyName: { equals: effectiveVendorName },
          }),
          select: { id: true },
        });
        if (vendorRecord) resolvedVendorId = vendorRecord.id;
      }

      // Resolve customerId when sender name changes or direct customerId is provided
      let resolvedCustomerId: number | undefined = undefined;
      const directCustId = body.customerId || body.selectedSender?.id;
      if (directCustId) {
        const cust = await tx.customers.findFirst({
          where: orgWhere(session, { id: Number(directCustId) }),
          select: { id: true },
        });
        if (cust) resolvedCustomerId = cust.id;
      } else if (senderName !== undefined) {
        const sName = String(senderName ?? "").trim();
        if (sName) {
          const cust = await tx.customers.findFirst({
            where: orgWhere(session, {
              OR: [
                { CompanyName: sName },
                { PersonName: sName },
              ],
            }),
            select: { id: true },
          });
          if (cust) resolvedCustomerId = cust.id;
        }
      }

      // 1. Update the shipment (including reference # and CoS — previously dropped on edit)
      const updatedShipment = await tx.shipment.update({
        where: { id },
        data: {
          trackingId,
          ...(referenceNumber !== undefined
            ? { referenceNumber: String(referenceNumber).trim() }
            : {}),
          shipmentDate: shipmentDate ? parseDateInputAsLocalDate(shipmentDate) : undefined,
          agency,
          office,
          senderName,
          senderAddress,
          recipientName,
          recipientAddress,
          destination,
          deliveryStatus,
          shippingMode,
          packaging,
          vendor,
          serviceMode,
          amount: amount ? parseInt(amount) : undefined,
          packageDescription,
          weight: weight ? parseFloat(weight) : undefined,
          length: length ? parseFloat(length) : undefined,
          width: width ? parseFloat(width) : undefined,
          height: height ? parseFloat(height) : undefined,
          weightVol: weightVol ? parseFloat(weightVol) : undefined,
          fixedCharge: fixedCharge !== undefined ? parseFloat(fixedCharge) || 0 : undefined,
          decValue: decValue !== undefined ? parseFloat(decValue) || 0 : undefined,
          price: price !== undefined ? originalPrice : undefined,
          discount: discount !== undefined ? parseFloat(discount) || 0 : undefined,
          fuelSurcharge: fuelSurcharge !== undefined ? parseFloat(fuelSurcharge) || 0 : undefined,
          insurance: insurance !== undefined ? parseFloat(insurance) || 0 : undefined,
          customs: customs !== undefined ? parseFloat(customs) || 0 : undefined,
          tax: tax !== undefined ? parseFloat(tax) || 0 : undefined,
          declaredValue: declaredValue !== undefined ? parseFloat(declaredValue) || 0 : undefined,
          reissue: reissue !== undefined ? parseFloat(reissue) || 0 : undefined,
          profitPercentage: profitPercentage !== undefined ? parseFloat(profitPercentage) || 0 : undefined,
          ...(cos !== undefined
            ? { cos: vendorTotalCost > 0 ? vendorTotalCost : (Number(existingShipment.cos) || 0) }
            : {}),
          totalCost: calculatedTotalCost,
          manualRate: manualRate !== undefined ? Boolean(manualRate) : undefined,
          totalPackages: totalPackages ? parseInt(totalPackages) : undefined,
          totalWeight: totalWeight ? parseFloat(totalWeight) : undefined,
          totalWeightVol: totalWeightVol ? parseFloat(totalWeightVol) : undefined,
          packages: packages ? JSON.stringify(packages) : undefined,
          packageTotals: packageTotals ? JSON.stringify(packageTotals) : undefined,
          calculatedValues: calculatedValues ? JSON.stringify(calculatedValues) : undefined,
          invoiceStatus,
        },
        include: {
          invoices: true,
        },
      });

      // 2. Update journal entry dates if shipment date changed
      if (shipmentDate) {
        const newShipmentDate = parseDateInputAsLocalDate(shipmentDate);
        const oldShipmentDate = existingShipment.shipmentDate;
        
        // Check if shipment date actually changed
        if (!oldShipmentDate || newShipmentDate.getTime() !== oldShipmentDate.getTime()) {
          console.log(`Shipment date changed from ${oldShipmentDate} to ${newShipmentDate}, updating journal entry dates...`);
          
          // Build search criteria for related journal entries using exact references
          const searchConditions: any[] = [];
          
          // Search by invoice numbers if invoices exist (exact reference and CREDIT-ref)
          if (updatedShipment.invoices && updatedShipment.invoices.length > 0) {
            const invoiceNumbers = updatedShipment.invoices
              .map((inv) => String(inv.invoiceNumber || "").trim())
              .filter(Boolean);
            
            if (invoiceNumbers.length > 0) {
              const exactRefs = [
                ...invoiceNumbers,
                ...invoiceNumbers.map((num) => `CREDIT-${num}`),
              ];
              searchConditions.push({ reference: { in: exactRefs } });
            }
          }
          
          // Search by tracking ID only if it is a meaningful non-trivial tracking number
          const cleanTracking = String(effectiveTrackingId || "").trim();
          if (cleanTracking.length >= 4 && !/^[.\-_/ ]+$/.test(cleanTracking)) {
            searchConditions.push({ reference: cleanTracking });
            searchConditions.push({ description: { contains: `shipment ${cleanTracking}` } });
          }
          
          // Find all journal entries related to this shipment
          if (searchConditions.length > 0) {
            const relatedJournalEntries = await tx.journalEntry.findMany({
              where: orgWhere(session, {
                OR: searchConditions
              })
            });
            
            console.log(`Found ${relatedJournalEntries.length} journal entries to update dates for`);
            
            // Update dates for all related journal entries
            if (relatedJournalEntries.length > 0) {
              await tx.journalEntry.updateMany({
                where: {
                  id: { in: relatedJournalEntries.map(je => je.id) }
                },
                data: {
                  date: newShipmentDate,
                  postedAt: newShipmentDate
                }
              });
              
              console.log(`✅ Updated ${relatedJournalEntries.length} journal entry dates to ${newShipmentDate.toISOString()}`);
            }
          }
        }
      }

      // 3. Update related invoices with shipment data
      // Also refresh when metadata changes (tracking, packaging, vendor, packages, etc.)
      const shouldUpdateInvoices =
        customerPricingChanged ||
        vendorPricingChanged ||
        (trackingId !== undefined && trackingId !== existingShipment.trackingId) ||
        (destination !== undefined && destination !== existingShipment.destination) ||
        shipmentDate !== undefined ||
        totalWeightChanged ||
        packagingChanged ||
        referenceChanged ||
        serviceModeChanged ||
        shippingModeChanged ||
        vendorChanged ||
        packagesChanged;
      
      if (updatedShipment.invoices && updatedShipment.invoices.length > 0 && shouldUpdateInvoices) {
        const buildLineItems = (forVendor: boolean) => {
          const lineItems: { description: string; value: number }[] = [];
          let parsedPackages: any[] = [];
          if (Array.isArray(packages)) {
            parsedPackages = packages;
          } else if (typeof packages === "string") {
            try {
              parsedPackages = JSON.parse(packages);
            } catch {
              parsedPackages = [];
            }
          } else if (existingShipment.packages) {
            try {
              parsedPackages =
                typeof existingShipment.packages === "string"
                  ? JSON.parse(existingShipment.packages)
                  : (existingShipment.packages as any[]);
            } catch {
              parsedPackages = [];
            }
          }

          const baseAmount = forVendor ? vendorTotalCost : originalPrice;

          if (Array.isArray(parsedPackages) && parsedPackages.length > 0) {
            const tw = parsedPackages.reduce(
              (sum: number, pkg: any) =>
                sum + Math.max(pkg.weight || 0, pkg.weightVol || 0),
              0
            );
            parsedPackages.forEach((pkg: any) => {
              const packageWeight = Math.max(pkg.weight || 0, pkg.weightVol || 0);
              const packageProportion =
                tw > 0 ? packageWeight / tw : 1 / parsedPackages.length;
              const packageValue = Math.round(baseAmount * packageProportion);
              lineItems.push({
                description: pkg.packageDescription || (forVendor ? "Vendor Service" : "Shipping Service"),
                value: packageValue,
              });
            });
          } else {
            lineItems.push({
              description: forVendor ? "Vendor Service" : "Shipping Service",
              value: Math.round(baseAmount),
            });
          }

          if (!forVendor && profitPercentageValue > 0) {
            lineItems.push({
              description: "Profit",
              value: Math.round(profitAmount),
            });
          }
          return lineItems;
        };

        for (const invoice of updatedShipment.invoices) {
          // CRITICAL: Check `invoice.profile === "Vendor"` FIRST so a vendor invoice with `vendorId: null`
          // is NEVER misclassified as a customer invoice!
          const isVendorInvoice =
            invoice.profile === "Vendor" ||
            (!invoice.profile && Boolean(invoice.vendorId && !invoice.customerId));

          const existingAmountNum = Number(invoice.totalAmount) || 0;

          // Self-heal if a previous edit mistakenly attached customerId to a Vendor invoice
          if (isVendorInvoice && invoice.customerId != null) {
            const bogusCustomerDebits = await tx.customerTransaction.findMany({
              where: {
                customerId: invoice.customerId,
                type: "DEBIT",
                OR: [
                  { reference: invoice.invoiceNumber },
                  { invoice: invoice.invoiceNumber },
                ],
              },
            });
            const bogusDebitSum = bogusCustomerDebits.reduce(
              (sum, t) => sum + (Number(t.amount) || 0),
              0
            );
            if (bogusCustomerDebits.length > 0) {
              await tx.customerTransaction.deleteMany({
                where: { id: { in: bogusCustomerDebits.map((t) => t.id) } },
              });
              await tx.customers.update({
                where: { id: invoice.customerId },
                data: { currentBalance: { increment: bogusDebitSum } },
              });
            }
          }

          // Only recalculate customer invoice amount when customer pricing fields changed,
          // and only recalculate vendor invoice amount when vendor pricing fields changed.
          let invoiceAmount: number;
          if (isVendorInvoice) {
            invoiceAmount =
              vendorPricingChanged && vendorTotalCost > 0
                ? vendorTotalCost
                : existingAmountNum > 0
                  ? existingAmountNum
                  : vendorTotalCost;
          } else {
            invoiceAmount = customerPricingChanged ? customerTotalCost : existingAmountNum;
          }

          const finalInvoiceAmount =
            typeof invoiceAmount === "number" && !isNaN(invoiceAmount)
              ? invoiceAmount
              : existingAmountNum;
          const oldInvoiceAmount = existingAmountNum;

          const rebuildThisInvoiceLineItems = isVendorInvoice
            ? packagesChanged || vendorPricingChanged
            : packagesChanged || customerPricingChanged;

          const nextLineItems = rebuildThisInvoiceLineItems
            ? buildLineItems(isVendorInvoice)
            : invoice.lineItems || [];

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              trackingNumber: effectiveTrackingId !== undefined ? effectiveTrackingId : invoice.trackingNumber,
              destination: effectiveDestination !== undefined ? effectiveDestination : invoice.destination,
              weight: effectiveTotalWeight || Number(invoice.weight) || 0,
              ...(shipmentDate ? { invoiceDate: parseDateInputAsLocalDate(shipmentDate) } : {}),
              lineItems: nextLineItems,
              totalAmount: finalInvoiceAmount,
              ...(!isVendorInvoice && customerPricingChanged
                ? {
                    fscCharges: fuelSurchargeAmount,
                    discount: discountAmount,
                  }
                : {}),
              ...(isVendorInvoice
                ? {
                    customerId: null,
                    ...(resolvedVendorId != null ? { vendorId: resolvedVendorId } : {}),
                  }
                : {
                    ...(resolvedCustomerId != null ? { customerId: resolvedCustomerId } : {}),
                  }),
              updatedAt: new Date(),
            },
          });

          // Move vendor DEBIT rows with the bill when vendor changes
          if (
            isVendorInvoice &&
            resolvedVendorId != null &&
            invoice.vendorId &&
            resolvedVendorId !== invoice.vendorId
          ) {
            await updateInvoiceBalance(
              tx,
              invoice.id,
              oldInvoiceAmount,
              finalInvoiceAmount,
              null,
              null,
              invoice.vendorId,
              resolvedVendorId
            );
          }

          // Move customer DEBIT rows with the invoice when customer changes
          if (
            !isVendorInvoice &&
            resolvedCustomerId != null &&
            invoice.customerId &&
            resolvedCustomerId !== invoice.customerId
          ) {
            await updateInvoiceBalance(
              tx,
              invoice.id,
              oldInvoiceAmount,
              finalInvoiceAmount,
              invoice.customerId,
              resolvedCustomerId,
              null,
              null
            );
          }

          const effectiveCustomerId = !isVendorInvoice
            ? (resolvedCustomerId ?? invoice.customerId)
            : null;
          const effectiveVendorId = isVendorInvoice
            ? (resolvedVendorId ?? invoice.vendorId)
            : null;

          // Ensure customer DEBIT row exists for customer invoice
          if (!isVendorInvoice && effectiveCustomerId && finalInvoiceAmount > 0) {
            const existingTx = await tx.customerTransaction.findFirst({
              where: {
                customerId: effectiveCustomerId,
                type: "DEBIT",
                OR: [
                  { reference: invoice.invoiceNumber },
                  { invoice: invoice.invoiceNumber },
                ],
              },
            });
            if (!existingTx) {
              const lineDesc = buildShipmentDebitTransactionLineDescription(
                effectiveTrackingId || invoice.trackingNumber || "N/A",
                effectiveDestination || invoice.destination || "N/A",
                packaging || existingShipment.packaging || "Wpx",
                effectiveTotalWeight || Number(invoice.weight) || 0
              );
              await addCustomerTransaction(
                tx,
                effectiveCustomerId,
                "DEBIT",
                finalInvoiceAmount,
                lineDesc,
                invoice.invoiceNumber,
                invoice.invoiceNumber,
                shipmentDate ? new Date(shipmentDate) : existingShipment.shipmentDate || new Date(),
                session.organizationId
              );
            }
          }

          // Ensure vendor DEBIT row exists for vendor invoice when vendor is resolved
          if (isVendorInvoice && effectiveVendorId && finalInvoiceAmount > 0) {
            const existingVendorTx = await tx.vendorTransaction.findFirst({
              where: {
                vendorId: effectiveVendorId,
                type: "DEBIT",
                OR: [
                  { reference: invoice.invoiceNumber },
                  { invoice: invoice.invoiceNumber },
                ],
              },
            });
            if (existingVendorTx && Math.abs((Number(existingVendorTx.amount) || 0) - finalInvoiceAmount) > 0.0001 && Math.abs(oldInvoiceAmount - finalInvoiceAmount) <= 0.0001) {
              const oldTxAmt = Number(existingVendorTx.amount) || 0;
              const diff = finalInvoiceAmount - oldTxAmt;
              const prevBal = Number(existingVendorTx.previousBalance) || 0;
              await tx.vendorTransaction.update({
                where: { id: existingVendorTx.id },
                data: {
                  amount: finalInvoiceAmount,
                  newBalance: prevBal + finalInvoiceAmount,
                },
              });
              await tx.vendors.update({
                where: { id: effectiveVendorId },
                data: { currentBalance: { increment: diff } },
              });
            }
            if (!existingVendorTx) {
              const lineDesc = buildShipmentDebitTransactionLineDescription(
                effectiveTrackingId || invoice.trackingNumber || "N/A",
                effectiveDestination || invoice.destination || "N/A",
                packaging || existingShipment.packaging || "Wpx",
                effectiveTotalWeight || Number(invoice.weight) || 0
              );
              await addVendorTransaction(
                tx,
                effectiveVendorId,
                "DEBIT",
                finalInvoiceAmount,
                lineDesc,
                invoice.invoiceNumber,
                invoice.invoiceNumber,
                shipmentDate ? new Date(shipmentDate) : existingShipment.shipmentDate || new Date(),
                session.organizationId
              );
            }
          }

          // 3. Update customer/vendor balances and journal entries
          try {
            const description = isVendorInvoice
              ? `Vendor invoice for shipment ${effectiveTrackingId || invoice.trackingNumber || "N/A"}`
              : `Customer invoice for shipment ${effectiveTrackingId || invoice.trackingNumber || "N/A"}`;

            // If invoice amount actually changed (and party didn't already get reassigned above), update party balance transactions
            const partyReassigned =
              (isVendorInvoice && resolvedVendorId != null && invoice.vendorId && resolvedVendorId !== invoice.vendorId) ||
              (!isVendorInvoice && resolvedCustomerId != null && invoice.customerId && resolvedCustomerId !== invoice.customerId);

            if (!partyReassigned && Math.abs(oldInvoiceAmount - finalInvoiceAmount) > 0.0001) {
              await updateInvoiceBalance(
                tx,
                invoice.id,
                oldInvoiceAmount,
                finalInvoiceAmount,
                effectiveCustomerId,
                effectiveCustomerId,
                effectiveVendorId,
                effectiveVendorId
              );
            }

            // Always synchronize or create missing journal entries
            if (finalInvoiceAmount > 0) {
              await updateJournalEntriesForInvoice(
                tx,
                invoice.id,
                oldInvoiceAmount,
                finalInvoiceAmount,
                effectiveCustomerId,
                effectiveCustomerId,
                effectiveVendorId,
                effectiveVendorId,
                invoice.invoiceNumber,
                description,
                session.organizationId,
                shipmentDate ? new Date(shipmentDate) : undefined
              );
            }

            console.log(`Successfully updated balances and journal entries for invoice ${invoice.invoiceNumber}`);
          } catch (balanceError) {
            console.error(`Error updating balances and journal entries for invoice ${invoice.invoiceNumber}:`, balanceError);
          }
        }
        
        // Log journal entry update summary
        console.log(`=== BALANCE & JOURNAL ENTRY UPDATE SUMMARY ===`);
        const customerInvoices = updatedShipment.invoices?.filter(inv => inv.customerId) || [];
        const vendorInvoices = updatedShipment.invoices?.filter(inv => inv.vendorId) || [];
        console.log(`Customer balances to update: ${customerInvoices.length}`);
        console.log(`Vendor balances to update: ${vendorInvoices.length}`);
        console.log(`Customer journal entries to update: ${customerInvoices.length}`);
        console.log(`Vendor journal entries to update: ${vendorInvoices.length}`);
        
        // Log balance calculation details
        console.log(`Balance calculation logic:`);
        console.log(`- For each transaction: newBalance = oldBalance - oldAmount + newAmount`);
        console.log(`- For customer/vendor: currentBalance = currentBalance + (newAmount - oldAmount)`);
        console.log(`=== END BALANCE & JOURNAL ENTRY UPDATE SUMMARY ===`);
        
        console.log(`=== INVOICE UPDATE SUMMARY ===`);
        console.log(`Updated ${updatedShipment.invoices?.length || 0} invoices for shipment ${trackingId}`);
        console.log(`Customer invoices: ${updatedShipment.invoices?.filter(inv => inv.customerId).length || 0}`);
        console.log(`Vendor invoices: ${updatedShipment.invoices?.filter(inv => inv.vendorId).length || 0}`);
        console.log(`Customer and vendor balances updated for all related transactions`);
        console.log(`Journal entries updated for all related transactions`);
        console.log(`=== END INVOICE UPDATE SUMMARY ===`);
        
        // Final summary of what was actually updated
        console.log(`=== FINAL UPDATE SUMMARY ===`);
        console.log(`✅ Shipment updated: ${trackingId}`);
        console.log(`✅ Invoices updated: ${updatedShipment.invoices?.length || 0}`);
        console.log(`✅ Customer balances updated: ${updatedShipment.invoices?.filter(inv => inv.customerId).length || 0}`);
        console.log(`✅ Vendor balances updated: ${updatedShipment.invoices?.filter(inv => inv.vendorId).length || 0}`);
        console.log(`✅ Journal entries updated: ${updatedShipment.invoices?.length || 0}`);
        
        // Show balance calculation examples
        if (customerInvoices.length > 0 || vendorInvoices.length > 0) {
          console.log(`Balance calculation examples:`);
          console.log(`- If old amount was $100 and new amount is $150: balance increases by $50`);
          console.log(`- If old amount was $200 and new amount is $150: balance decreases by $50`);
          console.log(`- If old amount was $100 and new amount is $100: balance stays the same`);
        }
        console.log(`=== END FINAL UPDATE SUMMARY ===`);
      }

      // 4. Keep customer/vendor invoice DEBIT transaction descriptions in sync with shipment metadata
      // (updateInvoiceBalance updates amounts but not descriptions; metadata-only edits skip that path)
      if (updatedShipment.invoices && updatedShipment.invoices.length > 0) {
        const wRaw = updatedShipment.totalWeight ?? updatedShipment.weight ?? 0;
        const wNum = typeof wRaw === "number" ? wRaw : parseFloat(String(wRaw)) || 0;
        const lineDescription = buildShipmentDebitTransactionLineDescription(
          String(updatedShipment.trackingId ?? ""),
          String(updatedShipment.destination ?? ""),
          String(updatedShipment.packaging ?? ""),
          wNum
        );
        await syncShipmentInvoiceDebitTransactionDescriptions(tx, {
          lineDescription,
          invoices: updatedShipment.invoices.map((inv) => ({
            customerId: inv.customerId,
            vendorId: inv.vendorId,
            invoiceNumber: inv.invoiceNumber,
          })),
        });
      }

      return updatedShipment;
    });

    return NextResponse.json({ 
      success: true, 
      shipment: result,
      calculation: price !== undefined ? {
        originalPrice: originalPrice,
        priceWithProfit: priceWithProfit,
        fuelSurcharge: fuelSurchargeAmount,
        discountPercentage: discountPercentage,
        discountAmount: discountAmount,
        profitPercentage: profitPercentageValue,
        profitAmount: profitAmount,
        customerTotalCost: customerTotalCost,
        vendorTotalCost: vendorTotalCost,
        totalCost: calculatedTotalCost, // Backward compatibility
      } : undefined,
      message: "Shipment, invoices, transactions, balances, and journal entries updated successfully",
    });
  } catch (error) {
    console.error("Error updating shipment:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to update shipment and related invoices",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
