import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber, generateVendorInvoiceNumber, addCustomerTransaction, addVendorTransaction, addCompanyTransaction } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const requestBody = await req.json();
    
    // Extract basic required fields
    const {
      trackingId,
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
      manualRate,
      packages,
      packageTotals,
      calculatedValues,
      totalPackages,
      totalWeight,
      totalWeightVol,
    } = requestBody;
    
    // Console log all the collected data
    console.log('=== SHIPMENT DATA RECEIVED ===');
    console.log('Basic Form Data:', {
      trackingId,
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
      manualRate,
    });
    
    console.log('Tracking Information:', {
      trackingId: trackingId,
    });
    
    console.log('Destination Information:', {
      finalDestination: destination,
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

    // Basic validation
    const requiredFields = [
      "trackingId",
      "senderName",
      "senderAddress",
      "recipientName",
      "recipientAddress",
      "destination",
    ];

    // Validate tracking ID
    if (!trackingId || trackingId.trim() === '') {
      return NextResponse.json(
        { success: false, message: "Tracking ID is required." },
        { status: 400 }
      );
    }

    // Validate destination
    if (!destination || destination.trim() === '') {
      return NextResponse.json(
        { success: false, message: "Destination is required." },
        { status: 400 }
      );
    }

    // Check if shipment with this tracking ID already exists
    const existingShipment = await prisma.shipment.findFirst({
      where: {
        trackingId: trackingId,
      },
    });
    
    if (existingShipment) {
      return NextResponse.json(
        { success: false, message: "Shipment with this tracking ID already exists." },
        { status: 400 }
      );
    }

    for (const field of requiredFields) {
      if (!eval(field)) {
        return NextResponse.json(
          { success: false, message: `${field} is required.` },
          { status: 400 }
        );
      }
    }

    // Calculate total cost: price + fuelSurcharge - percentage discount
    // The price from frontend already includes profit, so we need to extract the original price
    const priceWithProfit = Math.round((parseFloat(price) || 0));
    const fuelSurchargeAmount = Math.round((parseFloat(fuelSurcharge) || 0));
    const discountPercentage = parseFloat(discount) || 0;
    const profitPercentageValue = parseFloat(profitPercentage) || 0;
    
    // Calculate the original price by removing profit from the price with profit
    const originalPrice = profitPercentageValue > 0 ? Math.round((priceWithProfit / (1 + profitPercentageValue / 100)) * 100) / 100 : priceWithProfit;
    
    // Calculate discount amount as percentage of original price
    const discountAmount = Math.round(((originalPrice * discountPercentage) / 100));
    
    // Calculate profit amount as percentage of original price
    const profitAmount = Math.round(((originalPrice * profitPercentageValue) / 100));
    
    // Customer invoice uses the price with profit (from frontend)
    const customerTotalCost = Math.round((priceWithProfit + fuelSurchargeAmount - discountAmount));
    // Vendor invoice uses original price without profit
    const vendorTotalCost = Math.round((originalPrice + fuelSurchargeAmount - discountAmount));

    // Get subtotal from calculated values or use original price
    const subtotal = calculatedValues?.subtotal ? Math.round((calculatedValues.subtotal)) : originalPrice;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(prisma);

    // Store shipment in the database with all fields
    const shipment = await prisma.shipment.create({
      data: {
        trackingId,
        invoiceNumber,
        shipmentDate: shipmentDate ? new Date(shipmentDate) : new Date(),
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
        amount: parseInt(amount) || 1,
        packageDescription,
        weight: parseFloat(weight) || 0,
        length: parseFloat(length) || 0,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0,
        weightVol: parseFloat(weightVol) || 0,
        fixedCharge: parseFloat(fixedCharge) || 0,
        decValue: parseFloat(decValue) || 0,
        price: originalPrice, // Store original price without profit
        discount: discountPercentage,
        fuelSurcharge: fuelSurchargeAmount,
        insurance: parseFloat(insurance) || 0,
        customs: parseFloat(customs) || 0,
        tax: parseFloat(tax) || 0,
        declaredValue: parseFloat(declaredValue) || 0,
        reissue: parseFloat(reissue) || 0,
        totalCost: customerTotalCost, // Use customer total cost for shipment record
        subtotal,
        manualRate: Boolean(manualRate),
        totalPackages: parseInt(totalPackages) || 0,
        totalWeight: parseFloat(totalWeight) || 0,
        totalWeightVol: parseFloat(totalWeightVol) || 0,
        packages: packages ? JSON.stringify(packages) : undefined,
        packageTotals: packageTotals ? JSON.stringify(packageTotals) : undefined,
        calculatedValues: calculatedValues ? JSON.stringify(calculatedValues) : undefined,
      },
    });
    
    console.log('Shipment saved to database:', {
      id: shipment.id,
      trackingId: shipment.trackingId,
      invoiceNumber: shipment.invoiceNumber,
      destination: shipment.destination,
      totalCost: shipment.totalCost,
      subtotal: shipment.subtotal,
      totalPackages: shipment.totalPackages,
      totalWeight: shipment.totalWeight,
      createdAt: shipment.createdAt,
    });

        // Create two invoices: one for customer and one for vendor
        let customerInvoice = null;
        let vendorInvoice = null;
        
        // Initialize balance calculation variables
        let customerBalance = 0;
        let appliedBalance = 0;
        let remainingAmount = 0;
        let calculatedInvoiceStatus = "Pending";
        let vendorBalance = 0;
        let vendorAppliedBalance = 0;
        let vendorRemainingAmount = 0;
        let vendorCalculatedInvoiceStatus = "Pending";

        try {
       // Generate vendor invoice number (customer invoice + 5)
       const vendorInvoiceNumber = generateVendorInvoiceNumber(invoiceNumber);

                       // Find customer and vendor IDs
        let customerId = null;
        let vendorId = null;

        // Find customer by name
        if (senderName) {
          const customer = await prisma.customers.findFirst({
            where: { CompanyName: senderName }
          });
          customerId = customer?.id || null;
          customerBalance = customer?.currentBalance || 0;
        }

               // Find vendor by name
        if (vendor) {
          const vendorRecord = await prisma.vendors.findFirst({
            where: { CompanyName: vendor }
          });
          vendorId = vendorRecord?.id || null;
          vendorBalance = vendorRecord?.currentBalance || 0;
        }

                       // Calculate remaining amount based on customer balance
        remainingAmount = Math.max(0, customerTotalCost - customerBalance);
        appliedBalance = Math.min(customerBalance, customerTotalCost);
        
        // Determine invoice status based on remaining amount
        if (remainingAmount === 0) {
          calculatedInvoiceStatus = "Paid";
        } else if (appliedBalance > 0) {
          calculatedInvoiceStatus = "Partial";
        }

        // Calculate remaining amount based on vendor balance (inverted logic)
        // If vendor has positive balance, we owe them money, so apply it to reduce our debt
        // If vendor has negative balance, they owe us money, so we apply their debt to reduce our invoice
        if (vendorBalance > 0) {
          // We owe them money, apply their credit to reduce our debt
          vendorRemainingAmount = Math.max(0, vendorTotalCost - vendorBalance);
          vendorAppliedBalance = Math.min(vendorBalance, vendorTotalCost);
        } else {
          // They owe us money, apply their debt to reduce our invoice
          vendorAppliedBalance = Math.min(Math.abs(vendorBalance), vendorTotalCost);
          vendorRemainingAmount = Math.max(0, vendorTotalCost - vendorAppliedBalance);
        }
        console.log('Vendor balance:', vendorBalance);
        console.log('Vendor total cost:', vendorTotalCost);
        console.log('Vendor remaining amount:', vendorRemainingAmount);
        console.log('Vendor applied balance:', vendorAppliedBalance);
        // Determine vendor invoice status based on remaining amount
        if (vendorRemainingAmount === 0) {
          vendorCalculatedInvoiceStatus = "Paid";
        } else if (vendorAppliedBalance > 0) {
          vendorCalculatedInvoiceStatus = "Partial";
        }

        // Create customer invoice using the existing accounts API
        const customerLineItems = [
          { description: "Shipping Service", value: Math.round(originalPrice) },
          { description: "Fuel Surcharge", value: Math.round(fuelSurchargeAmount) },
          { description: "Discount", value: Math.round(-discountAmount) }
        ];
        
        // Add profit line item if profit percentage is greater than 0
        if (profitPercentageValue > 0) {
          customerLineItems.push({ description: "Profit", value: Math.round(profitAmount) });
        }

        // Add balance applied line item if customer has balance
        if (appliedBalance > 0) {
          customerLineItems.push({ description: "Balance Applied", value: Math.round(-appliedBalance) });
        }

       const customerInvoiceResponse = await fetch(`${req.nextUrl.origin}/api/accounts/invoices`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           invoiceNumber: invoiceNumber,
           invoiceDate: shipmentDate ? new Date(shipmentDate).toISOString() : new Date().toISOString(),
           trackingNumber: trackingId,
           destination: destination,
           weight: parseFloat(totalWeight) || 0,
           profile: "Customer",
           fscCharges: Math.round(fuelSurchargeAmount),
           lineItems: customerLineItems,
           customerId: customerId,
           vendorId: null,
           shipmentId: shipment.id,
                       disclaimer: "Thank you for your business",
            totalAmount: customerTotalCost, // Use original customer total cost (includes profit)
            currency: "USD",
            status: calculatedInvoiceStatus
         })
       });

       if (customerInvoiceResponse.ok) {
         customerInvoice = await customerInvoiceResponse.json();
       }

               // Create vendor invoice using the existing accounts API
        // Vendor invoice uses original price without profit
        const vendorLineItems = [
          { description: "Vendor Service", value: Math.round(originalPrice) },
          { description: "Fuel Surcharge", value: Math.round(fuelSurchargeAmount) },
          { description: "Discount", value: Math.round(-discountAmount) }
        ];
        
        // Add balance applied line item if vendor has balance (positive or negative)
        if (vendorAppliedBalance > 0) {
          vendorLineItems.push({ description: "Balance Applied", value: Math.round(-vendorAppliedBalance) });
        }
        
        // Ensure vendor total cost is properly rounded
        const roundedVendorTotalCost = Math.round(vendorTotalCost);

        const vendorInvoiceResponse = await fetch(`${req.nextUrl.origin}/api/accounts/invoices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceNumber: vendorInvoiceNumber,
            invoiceDate: shipmentDate ? new Date(shipmentDate).toISOString() : new Date().toISOString(),
            trackingNumber: trackingId,
            destination: destination,
            weight: parseFloat(totalWeight) || 0,
            profile: "Vendor",
            fscCharges: 0,
            lineItems: vendorLineItems,
            customerId: null,
            vendorId: vendorId,
            shipmentId: shipment.id,
            disclaimer: "Vendor invoice - original cost without profit",
            totalAmount: vendorTotalCost, // Use original vendor total cost (no profit)
            currency: "USD",
            status: vendorCalculatedInvoiceStatus
          })
        });

               if (vendorInvoiceResponse.ok) {
          vendorInvoice = await vendorInvoiceResponse.json();
        }

        console.log('Invoices created successfully:', {
          customerInvoice: customerInvoice?.invoiceNumber,
          vendorInvoice: vendorInvoice?.invoiceNumber
        });

                 // Create financial transactions
         try {
           
                       // Customer transaction (DEBIT - they owe us money)
            if (customerId && remainingAmount > 0) {
              await addCustomerTransaction(
                prisma,
                customerId,
                'DEBIT',
                remainingAmount,
                `Invoice for shipment ${trackingId}`,
                invoiceNumber
              );
            }

            // If customer has balance and it was applied, create a payment transaction
            if (customerId && appliedBalance > 0) {
              // Create payment record for balance application
              await prisma.payment.create({
                data: {
                  transactionType: "INCOME",
                  category: "Balance Applied",
                  date: new Date(),
                  currency: "USD",
                  amount: appliedBalance,
                  fromPartyType: "CUSTOMER",
                  fromCustomerId: customerId,
                  fromCustomer: senderName || "",
                  toPartyType: "US",
                  toVendorId: null,
                  toVendor: "",
                  mode: "CASH",
                  reference: invoiceNumber,
                  description: `Credit applied for invoice ${invoiceNumber}`
                }
              });

              // Create CREDIT transaction for customer (reduces their balance)
              await addCustomerTransaction(
                prisma,
                customerId,
                'DEBIT',
                appliedBalance,
                `Credit applied for invoice ${invoiceNumber}`,
                `CREDIT-${invoiceNumber}`
              );

              // Create CREDIT transaction for company (we receive money)
              await addCompanyTransaction(
                prisma,
                'DEBIT',
                appliedBalance,
                `Customer credit applied for invoice ${invoiceNumber}`,
                `CREDIT-${invoiceNumber}`
              );
            }

            // Vendor transaction (DEBIT - we owe vendor money)
            if (vendorId && vendorRemainingAmount > 0) {
              await addVendorTransaction(
                prisma,
                vendorId,
                'DEBIT',
                vendorRemainingAmount,
                `Vendor invoice for shipment ${trackingId}`,
                vendorInvoiceNumber
              );
            }

            // If vendor has balance and it was applied, create a payment transaction
            if (vendorId && vendorAppliedBalance > 0) {
              // Create payment record for vendor balance application
              await prisma.payment.create({
                data: {
                  transactionType: "EXPENSE",
                  category: "Balance Applied",
                  date: new Date(),
                  currency: "USD",
                  amount: vendorAppliedBalance,
                  fromPartyType: "US",
                  fromCustomerId: null,
                  fromCustomer: "",
                  toPartyType: "VENDOR",
                  toVendorId: vendorId,
                  toVendor: vendor || "",
                  mode: "CASH",
                  reference: vendorInvoiceNumber,
                  description: `Credit applied for vendor invoice ${vendorInvoiceNumber}`
                }
              });

              // Create CREDIT transaction for vendor (reduces what we owe them)
              await addVendorTransaction(
                prisma,
                vendorId,
                'DEBIT',
                vendorAppliedBalance,
                `Credit applied for vendor invoice ${vendorInvoiceNumber}`,
                `CREDIT-${vendorInvoiceNumber}`
              );

              // Create CREDIT transaction for company (reduces our liability)
              await addCompanyTransaction(
                prisma,
                'CREDIT',
                vendorAppliedBalance,
                `Vendor credit applied for invoice ${vendorInvoiceNumber}`,
                `CREDIT-${vendorInvoiceNumber}`
              );
            }

          console.log('Financial transactions created successfully');

        } catch (transactionError) {
          console.error('Error creating financial transactions:', transactionError);
          // Don't fail the shipment creation if transaction creation fails
        }

      } catch (invoiceError) {
        console.error('Error creating invoices:', invoiceError);
        // Don't fail the shipment creation if invoice creation fails
        // The shipment is already saved, we just log the error
      }

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
        destination: destination,
        totalPackages: totalPackages,
        totalWeight: totalWeight,
        totalWeightVol: totalWeightVol,
        calculatedValues: calculatedValues,
      },
    });
  } catch (error) {
    console.error("Add shipment error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add shipment." },
      { status: 500 }
    );
  }
}
