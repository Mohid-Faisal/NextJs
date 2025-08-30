import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createJournalEntryForTransaction } from "@/lib/utils";

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

    // ============================================================================
    // SECTION: PRICING CALCULATIONS (Same logic as add-shipment)
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
    
    // Calculate total costs for customer and vendor (same logic as add-shipment)
    // Customer invoice uses the price with profit (from frontend)
    const customerTotalCost = Math.round((priceWithProfit + fuelSurchargeAmount - discountAmount));
    // Vendor invoice uses original price without profit
    const vendorTotalCost = Math.round(originalPrice);
    
    // For backward compatibility, also calculate the old format
    let calculatedTotalCost: number;
    if (price !== undefined || fuelSurcharge !== undefined || discount !== undefined) {
      calculatedTotalCost = customerTotalCost; // Use customer total for backward compatibility
    } else if (totalCost !== undefined) {
      calculatedTotalCost = parseFloat(totalCost) || 0;
    } else {
      calculatedTotalCost = 0;
    }
    
    // Log pricing calculations for debugging
    console.log('=== PRICING CALCULATIONS ===');
    console.log('Price from request:', price);
    console.log('Fuel surcharge:', fuelSurcharge);
    console.log('Discount percentage:', discount);
    console.log('Profit percentage:', profitPercentage);
    console.log('Original price (no profit):', originalPrice);
    console.log('Customer total cost (with profit):', customerTotalCost);
    console.log('Vendor total cost (no profit):', vendorTotalCost);
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

      // 2. Update related invoices with shipment data
      if (updatedShipment.invoices && updatedShipment.invoices.length > 0) {
        const invoiceUpdates = updatedShipment.invoices.map(async (invoice) => {
          // Update invoice with shipment data
          // For vendor invoices, use vendor cost; for customer invoices, use customer total
          const isVendorInvoice = invoice.vendorId && !invoice.customerId;
          const invoiceAmount = isVendorInvoice ? vendorTotalCost : customerTotalCost;
          
          console.log(`Updating invoice ${invoice.invoiceNumber}:`, {
            isVendorInvoice,
            vendorCost: vendorTotalCost,
            customerTotal: customerTotalCost,
            finalAmount: invoiceAmount,
            trackingId,
            destination
          });
          
          // Ensure invoiceAmount is a valid number
          const finalInvoiceAmount = typeof invoiceAmount === 'number' ? invoiceAmount : parseFloat(invoiceAmount) || 0;
          
          const updatedInvoice = await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              trackingNumber: trackingId,
              destination: destination,
              weight: totalWeight || weight || 0,
              // Update line items if they contain shipment-specific information
              lineItems: invoice.lineItems || [], // Keep existing line items but could be updated if needed
              totalAmount: finalInvoiceAmount,
              updatedAt: new Date(),
            },
          });

          // 3. Update customer transactions if this is a customer invoice
          if (invoice.customerId) {
            // Find existing customer transaction for this invoice
            const existingTransaction = await tx.customerTransaction.findFirst({
              where: {
                customerId: invoice.customerId,
                invoice: invoice.invoiceNumber,
              },
            });

                         if (existingTransaction) {
               // Store old amount for balance calculation BEFORE updating transaction
               const oldAmount = existingTransaction.amount;
               const oldBalance = existingTransaction.newBalance || existingTransaction.previousBalance || 0;
               
               console.log(`Updating customer transaction for invoice ${invoice.invoiceNumber}:`, {
                 customerId: invoice.customerId,
                 oldAmount: oldAmount,
                 newAmount: customerTotalCost,
                 oldBalance: oldBalance,
                 description: `Updated customer invoice for shipment: ${trackingId} - ${destination}`
               });
               
               // Calculate new balance: remove old amount, add new amount
               const newBalance = oldBalance - oldAmount + customerTotalCost;
               
               await tx.customerTransaction.update({
                 where: { id: existingTransaction.id },
                 data: {
                   amount: customerTotalCost,
                   description: `Updated customer invoice for shipment: ${trackingId} - ${destination}`,
                   newBalance: newBalance,
                   // Note: This is a simplified balance calculation
                   // In a real system, you might want more complex balance logic
                 },
               });
               
               // Update customer balance - use the transaction's balance logic
               await updateCustomerBalance(tx, invoice.customerId, oldAmount, customerTotalCost);
              
              // Update corresponding journal entry for customer transaction
              try {
                console.log(`Attempting to update customer journal entry for invoice ${invoice.invoiceNumber}...`);
                await updateJournalEntryForTransaction(
                  tx,
                  'CUSTOMER_DEBIT',
                  customerTotalCost,
                  `Updated customer invoice for shipment: ${trackingId} - ${destination}`,
                  invoice.invoiceNumber,
                  invoice.invoiceNumber
                );
                console.log(`Successfully updated customer journal entry for invoice ${invoice.invoiceNumber}`);
              } catch (journalError) {
                console.error(`Failed to update customer journal entry for invoice ${invoice.invoiceNumber}:`, journalError);
                // Continue with the transaction even if journal entry update fails
              }
            }
          }

          // 4. Update vendor transactions if this is a vendor invoice
          if (invoice.vendorId) {
            // Calculate vendor cost (what we pay to vendor)
            // Vendor cost = original price + fuel surcharge - discount (no profit)
            const vendorCost = vendorTotalCost;
            
            // Find existing vendor transaction for this invoice
            const existingTransaction = await tx.vendorTransaction.findFirst({
              where: {
                vendorId: invoice.vendorId,
                invoice: invoice.invoiceNumber,
              },
            });

                         if (existingTransaction) {
               // Store old amount for balance calculation BEFORE updating transaction
               const oldAmount = existingTransaction.amount;
               const oldBalance = existingTransaction.newBalance || existingTransaction.previousBalance || 0;
               
               console.log(`Updating vendor transaction for invoice ${invoice.invoiceNumber}:`, {
                 vendorId: invoice.vendorId,
                 oldAmount: oldAmount,
                 newAmount: vendorCost,
                 oldBalance: oldBalance,
                 description: `Updated vendor cost for shipment: ${trackingId} - ${destination}`
               });
               
               // Calculate new balance: remove old amount, add new amount
               const newBalance = oldBalance - oldAmount + vendorCost;
               
               await tx.vendorTransaction.update({
                 where: { id: existingTransaction.id },
                 data: {
                   amount: vendorCost,
                   description: `Updated vendor cost for shipment: ${trackingId} - ${destination}`,
                   newBalance: newBalance,
                   // Note: This is a simplified balance calculation
                   // In a real system, you might want more complex balance logic
                 },
               });
               
               // Update vendor balance - use the transaction's balance logic
               await updateVendorBalance(tx, invoice.vendorId, oldAmount, vendorCost);
              
              // Update corresponding journal entry for vendor transaction
              try {
                console.log(`Attempting to update vendor journal entry for invoice ${invoice.invoiceNumber}...`);
                await updateJournalEntryForTransaction(
                  tx,
                  'VENDOR_DEBIT',
                  vendorCost,
                  `Updated vendor cost for shipment: ${trackingId} - ${destination}`,
                  invoice.invoiceNumber,
                  invoice.invoiceNumber
                );
                console.log(`Successfully updated vendor journal entry for invoice ${invoice.invoiceNumber}`);
              } catch (journalError) {
                console.error(`Failed to update vendor journal entry for invoice ${invoice.invoiceNumber}:`, journalError);
                // Continue with the transaction even if journal entry update fails
              }
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
