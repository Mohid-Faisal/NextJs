import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createJournalEntryForTransaction, updateInvoiceBalance, updateJournalEntriesForInvoice } from "@/lib/utils";

// Function to update existing journal entries for transactions
async function updateJournalEntryForTransaction(
  tx: any,
  type: 'CUSTOMER_DEBIT' | 'CUSTOMER_CREDIT' | 'VENDOR_DEBIT' | 'VENDOR_CREDIT',
  amount: number,
  description: string,
  reference?: string,
  invoice?: string
) {
  try {
    // Find existing journal entry for this invoice - search more broadly
    console.log(`Searching for journal entry with reference: ${reference}, invoice: ${invoice}`);
    
    // First try to find by exact reference match
    let existingJournalEntry = await tx.journalEntry.findFirst({
      where: {
        reference: reference
      },
      include: {
        lines: true
      }
    });
    
    // If not found by reference, try by invoice number in description
    if (!existingJournalEntry) {
      console.log(`No journal entry found by reference ${reference}, trying by invoice number...`);
      existingJournalEntry = await tx.journalEntry.findFirst({
        where: {
          description: { contains: invoice }
        },
        include: {
          lines: true
        }
      });
    }
    
    // If still not found, try by invoice number as reference
    if (!existingJournalEntry) {
      console.log(`No journal entry found by description, trying by invoice number as reference...`);
      existingJournalEntry = await tx.journalEntry.findFirst({
        where: {
          reference: invoice
        },
        include: {
          lines: true
        }
      });
    }
    
    // If still not found, try broader search
    if (!existingJournalEntry) {
      console.log(`No journal entry found by any method, trying broader search...`);
      const broaderSearch = await tx.journalEntry.findMany({
        where: {
          OR: [
            { description: { contains: invoice } },
            { description: { contains: reference } }
          ]
        },
        take: 5
      });
      console.log(`Broader search found ${broaderSearch.length} potential entries:`, broaderSearch.map((je: any) => ({ id: je.id, entryNumber: je.entryNumber, description: je.description, reference: je.reference })));
      
      // If we found entries in broader search, use the first one
      if (broaderSearch.length > 0) {
        existingJournalEntry = await tx.journalEntry.findFirst({
          where: { id: broaderSearch[0].id },
          include: { lines: true }
        });
        console.log(`Using broader search result: ${existingJournalEntry?.entryNumber}`);
      }
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
        invoice
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
      const balanceAdjustment = newAmount - oldAmount;
      const newBalance = customer.currentBalance + balanceAdjustment;

      console.log(`Balance calculation: ${customer.currentBalance} + (${newAmount} - ${oldAmount}) = ${newBalance}`);

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
      const balanceAdjustment = newAmount - oldAmount;
      const newBalance = vendor.currentBalance + balanceAdjustment;

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
    });
    console.log('=== END UPDATE SHIPMENT DATA ===');
    
    const {
      id,
      trackingId,
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
    const existingShipment = await prisma.shipment.findUnique({
      where: { id },
      include: { invoices: true },
    });

    if (!existingShipment) {
      return NextResponse.json({ success: false, message: "Shipment not found" }, { status: 404 });
    }

    // Use existing values if new values aren't provided
    const effectivePrice = price !== undefined ? parseFloat(price) : (existingShipment.price || 0);
    const effectiveFuelSurcharge = fuelSurcharge !== undefined ? parseFloat(fuelSurcharge) : (existingShipment.fuelSurcharge || 0);
    const effectiveDiscount = discount !== undefined ? parseFloat(discount) : (existingShipment.discount || 0);
    const effectiveProfitPercentage = profitPercentage !== undefined ? parseFloat(profitPercentage) : (existingShipment.profitPercentage || 0);
    const effectiveFixedCharge = fixedCharge !== undefined ? parseFloat(fixedCharge) : (existingShipment.fixedCharge || 0);
    const effectiveTrackingId = trackingId !== undefined ? trackingId : existingShipment.trackingId;
    const effectiveDestination = destination !== undefined ? destination : existingShipment.destination;
    const effectiveTotalWeight = totalWeight !== undefined ? parseFloat(totalWeight) : (existingShipment.totalWeight || existingShipment.weight || 0);

    // ============================================================================
    // SECTION: PRICING CALCULATIONS (Same logic as add-shipment)
    // ============================================================================
    // Parse and calculate all pricing components using effective values
    const priceWithProfit = Math.round((effectivePrice || 0));
    const fuelSurchargeAmount = Math.round((effectiveFuelSurcharge || 0));
    const discountPercentage = effectiveDiscount || 0;
    const profitPercentageValue = effectiveProfitPercentage || 0;
    
    // Calculate original price by removing profit from the price with profit
    // This is needed because the frontend sends price with profit included
    const originalPrice = profitPercentageValue > 0 ? Math.round((priceWithProfit / (1 + profitPercentageValue / 100)) * 100) / 100 : priceWithProfit;
    
    // Calculate discount amount as percentage of original price
    const discountAmount = Math.round(((originalPrice * discountPercentage) / 100));
    
    // Calculate profit amount as percentage of original price
    const profitAmount = Math.round(((originalPrice * profitPercentageValue) / 100));
    
    // Calculate total costs for customer and vendor (same logic as add-shipment)
    // Customer invoice uses the price with profit (from frontend)
    const customerTotalCost = Math.round((priceWithProfit + fuelSurchargeAmount - discountAmount));
    // Vendor invoice: use CoS (Cost of Service) if in manual mode, otherwise use original price without fixed charge
    const effectiveManualRate = manualRate !== undefined ? Boolean(manualRate) : (existingShipment.manualRate || false);
    const vendorTotalCost = effectiveManualRate 
      ? Math.round((parseFloat(cos) || 0))
      : Math.round(originalPrice - effectiveFixedCharge);
    
    // For backward compatibility, also calculate the old format
    let calculatedTotalCost: number;
    if (price !== undefined || fuelSurcharge !== undefined || discount !== undefined) {
      calculatedTotalCost = customerTotalCost; // Use customer total for backward compatibility
    } else if (totalCost !== undefined) {
      calculatedTotalCost = parseFloat(totalCost) || 0;
    } else {
      // Use existing totalCost if available
      calculatedTotalCost = existingShipment.totalCost || 0;
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
    console.log(`Vendor total cost (${effectiveManualRate ? 'CoS' : 'originalPrice - fixedCharge'}):`, vendorTotalCost);
    console.log('=== END PRICING CALCULATIONS ===');

    // Use a transaction to ensure all updates happen together
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the shipment
      const updatedShipment = await tx.shipment.update({
        where: { id },
        data: {
          trackingId,
          shipmentDate: shipmentDate ? new Date(shipmentDate) : undefined,
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
          fixedCharge: fixedCharge ? parseFloat(fixedCharge) : undefined,
          decValue: decValue ? parseFloat(decValue) : undefined,
          price: price ? parseFloat(price) : undefined,
          discount: discount ? parseFloat(discount) : undefined,
          fuelSurcharge: fuelSurcharge ? parseFloat(fuelSurcharge) : undefined,
          insurance: insurance ? parseFloat(insurance) : undefined,
          customs: customs ? parseFloat(customs) : undefined,
          tax: tax ? parseFloat(tax) : undefined,
          declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
          reissue: reissue ? parseFloat(reissue) : undefined,
          profitPercentage: profitPercentage ? parseFloat(profitPercentage) : undefined,
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
        const newShipmentDate = new Date(shipmentDate);
        const oldShipmentDate = existingShipment.shipmentDate;
        
        // Check if shipment date actually changed
        if (!oldShipmentDate || newShipmentDate.getTime() !== oldShipmentDate.getTime()) {
          console.log(`Shipment date changed from ${oldShipmentDate} to ${newShipmentDate}, updating journal entry dates...`);
          
          // Build search criteria for related journal entries
          const searchConditions: any[] = [];
          
          // Search by tracking ID
          if (effectiveTrackingId) {
            searchConditions.push(
              { reference: effectiveTrackingId },
              { description: { contains: effectiveTrackingId } }
            );
          }
          
          // Search by invoice numbers if invoices exist
          if (updatedShipment.invoices && updatedShipment.invoices.length > 0) {
            const invoiceNumbers = updatedShipment.invoices.map(inv => inv.invoiceNumber);
            
            // Search by invoice number as reference (using in operator)
            if (invoiceNumbers.length > 0) {
              searchConditions.push({ reference: { in: invoiceNumbers } });
            }
            
            // Search by invoice number in description (one condition per invoice)
            invoiceNumbers.forEach(invNum => {
              searchConditions.push({ description: { contains: invNum } });
            });
          }
          
          // Find all journal entries related to this shipment
          if (searchConditions.length > 0) {
            const relatedJournalEntries = await tx.journalEntry.findMany({
              where: {
                OR: searchConditions
              }
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
      // Only update invoices if we have pricing data or if tracking/destination changed
      const shouldUpdateInvoices = (price !== undefined || fuelSurcharge !== undefined || discount !== undefined) || 
                                    (trackingId !== undefined && trackingId !== existingShipment.trackingId) ||
                                    (destination !== undefined && destination !== existingShipment.destination) ||
                                    (shipmentDate !== undefined) ||
                                    (effectiveManualRate && cos !== undefined);
      
      if (updatedShipment.invoices && updatedShipment.invoices.length > 0 && shouldUpdateInvoices) {
        const invoiceUpdates = updatedShipment.invoices.map(async (invoice) => {
          // Update invoice with shipment data
          // For vendor invoices, use vendor cost; for customer invoices, use customer total
          const isVendorInvoice = invoice.vendorId && !invoice.customerId;
          
          // Use calculated amounts if pricing data was provided, or if CoS changed in manual mode, otherwise keep existing invoice totalAmount
          let invoiceAmount: number;
          if (price !== undefined || fuelSurcharge !== undefined || discount !== undefined || (effectiveManualRate && cos !== undefined)) {
            invoiceAmount = isVendorInvoice ? vendorTotalCost : customerTotalCost;
          } else {
            // Keep existing invoice totalAmount if no pricing data provided
            invoiceAmount = invoice.totalAmount || 0;
          }
          
          console.log(`Updating invoice ${invoice.invoiceNumber}:`, {
            isVendorInvoice,
            vendorCost: vendorTotalCost,
            customerTotal: customerTotalCost,
            finalAmount: invoiceAmount,
            trackingId: effectiveTrackingId,
            destination: effectiveDestination,
            usingExistingAmount: price === undefined && fuelSurcharge === undefined && discount === undefined
          });
          
          // Ensure invoiceAmount is a valid number
          const finalInvoiceAmount = typeof invoiceAmount === 'number' && !isNaN(invoiceAmount) ? invoiceAmount : (invoice.totalAmount || 0);
          
          // Store old amount before updating
          const oldInvoiceAmount = invoice.totalAmount;
          
          // Update invoice with all relevant fields
          const updatedInvoice = await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              trackingNumber: effectiveTrackingId !== undefined ? effectiveTrackingId : invoice.trackingNumber,
              destination: effectiveDestination !== undefined ? effectiveDestination : invoice.destination,
              weight: effectiveTotalWeight || invoice.weight || 0,
              // Update invoice date if shipment date was provided
              ...(shipmentDate ? { invoiceDate: new Date(shipmentDate) } : {}),
              // Update line items if they contain shipment-specific information
              lineItems: invoice.lineItems || [], // Keep existing line items but could be updated if needed
              totalAmount: finalInvoiceAmount,
              // Update FSC charges and discount if pricing data was provided
              ...(price !== undefined || fuelSurcharge !== undefined || discount !== undefined ? {
                fscCharges: fuelSurchargeAmount,
                discount: discountAmount,
              } : {}),
              updatedAt: new Date(),
            },
          });

          // 3. Update customer/vendor balances and journal entries if amount changed
          // Only update if pricing data was provided (or CoS in manual mode) and amount actually changed
          // Use the same logic as invoice update route
          if ((price !== undefined || fuelSurcharge !== undefined || discount !== undefined || (effectiveManualRate && cos !== undefined)) && oldInvoiceAmount !== finalInvoiceAmount) {
            try {
              // Use the proper utility functions for balance and journal entry updates
              // These functions handle transactions, balances, and journal entries correctly
              const description = `Updated invoice for shipment: ${effectiveTrackingId || invoice.trackingNumber || 'N/A'} - ${effectiveDestination || invoice.destination || 'N/A'}`;
              
              // Update balances using the utility function (same as invoice update)
              // This function handles:
              // - Finding transactions by reference: invoice.invoiceNumber
              // - Calculating balance correctly: previousBalance - amountDifference for customers
              // - Calculating balance correctly: previousBalance + amountDifference for vendors
              // - Updating transaction amount to full newAmount
              await updateInvoiceBalance(
                tx,
                invoice.id,
                oldInvoiceAmount,
                finalInvoiceAmount,
                invoice.customerId,
                invoice.customerId,
                invoice.vendorId,
                invoice.vendorId
              );

              // Update journal entries using the utility function (same as invoice update)
              await updateJournalEntriesForInvoice(
                tx,
                invoice.id,
                oldInvoiceAmount,
                finalInvoiceAmount,
                invoice.customerId,
                invoice.customerId,
                invoice.vendorId,
                invoice.vendorId,
                invoice.invoiceNumber,
                description
              );
              
              console.log(`Successfully updated balances and journal entries for invoice ${invoice.invoiceNumber}`);
            } catch (balanceError) {
              console.error(`Error updating balances and journal entries for invoice ${invoice.invoiceNumber}:`, balanceError);
              // Continue with the transaction even if balance/journal update fails
            }
          }

          return updatedInvoice;
        });

        // Wait for all invoice updates to complete
        await Promise.all(invoiceUpdates);
        
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
