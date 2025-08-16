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
    const priceWithProfit = parseFloat(price) || 0;
    const fuelSurchargeAmount = parseFloat(fuelSurcharge) || 0;
    const discountPercentage = parseFloat(discount) || 0;
    const profitPercentageValue = parseFloat(profitPercentage) || 0;
    
    // Calculate the original price by removing profit from the price with profit
    const originalPrice = profitPercentageValue > 0 ? priceWithProfit / (1 + profitPercentageValue / 100) : priceWithProfit;
    
    // Calculate discount amount as percentage of original price
    const discountAmount = (originalPrice * discountPercentage) / 100;
    
    // Calculate profit amount as percentage of original price
    const profitAmount = (originalPrice * profitPercentageValue) / 100;
    
    // Customer invoice uses the price with profit (from frontend)
    const customerTotalCost = priceWithProfit + fuelSurchargeAmount - discountAmount;
    // Vendor invoice uses original price without profit
    const vendorTotalCost = originalPrice + fuelSurchargeAmount - discountAmount;

    // Get subtotal from calculated values or use original price
    const subtotal = calculatedValues?.subtotal || originalPrice;

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
       }

       // Find vendor by name
       if (vendor) {
         const vendorRecord = await prisma.vendors.findFirst({
           where: { CompanyName: vendor }
         });
         vendorId = vendorRecord?.id || null;
       }

       // Create customer invoice using the existing accounts API
       const customerLineItems = [
         { description: "Shipping Service", value: originalPrice },
         { description: "Fuel Surcharge", value: fuelSurchargeAmount },
         { description: "Discount", value: -discountAmount }
       ];
       
       // Add profit line item if profit percentage is greater than 0
       if (profitPercentageValue > 0) {
         customerLineItems.push({ description: "Profit", value: profitAmount });
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
           fscCharges: fuelSurchargeAmount,
           lineItems: customerLineItems,
           customerId: customerId,
           vendorId: null,
           shipmentId: shipment.id,
           disclaimer: "Thank you for your business",
           totalAmount: customerTotalCost, // Use customer total cost (includes profit)
           currency: "USD"
         })
       });

       if (customerInvoiceResponse.ok) {
         customerInvoice = await customerInvoiceResponse.json();
       }

               // Create vendor invoice using the existing accounts API
        // Vendor invoice uses original price without profit
        const vendorLineItems = [
          { description: "Vendor Service", value: originalPrice },
          { description: "Fuel Surcharge", value: fuelSurchargeAmount },
          { description: "Discount", value: -discountAmount }
        ];

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
            totalAmount: vendorTotalCost, // Use vendor total cost (no profit)
            currency: "USD"
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
                       // Business Logic:
            // 1. Customer DEBIT: Customer owes us money for the shipment
            // 2. Company DEBIT: We owe vendor money (our liability - decreases our balance)
            //    Note: Since vendor cost is $0 initially, no company transaction created yet
            // 3. No vendor transaction yet - vendor gets paid when we process payment
            // 4. Vendor invoice starts at $0 - actual cost will be set later via invoice edit
           
           // Customer transaction (DEBIT - they owe us money)
           if (customerId && customerTotalCost > 0) {
             await addCustomerTransaction(
               prisma,
               customerId,
               'DEBIT',
               customerTotalCost,
               `Invoice for shipment ${trackingId}`,
               invoiceNumber
             );
           }

           // Vendor transaction (DEBIT - we owe vendor money)
           if (vendorId && vendorTotalCost > 0) {
             await addVendorTransaction(
               prisma,
               vendorId,
               'DEBIT',
               vendorTotalCost,
               `Vendor invoice for shipment ${trackingId}`,
               vendorInvoiceNumber
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
