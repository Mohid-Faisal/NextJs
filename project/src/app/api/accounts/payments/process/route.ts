import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCustomerTransaction, addVendorTransaction, addCompanyTransaction, calculateInvoicePaymentStatus } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      invoiceNumber, 
      paymentAmount, 
      paymentType, // "CUSTOMER_PAYMENT" or "VENDOR_PAYMENT"
      paymentMethod,
      reference,
      description 
    } = body;

    if (!invoiceNumber || !paymentAmount || !paymentType) {
      return NextResponse.json(
        { error: "Invoice number, payment amount, and payment type are required" },
        { status: 400 }
      );
    }

    // Find the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        customer: true,
        vendor: true
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const paymentAmountNum = parseFloat(paymentAmount);

    if (paymentType === "CUSTOMER_PAYMENT") {
      // Customer is paying their invoice
      if (!invoice.customerId) {
        return NextResponse.json(
          { error: "This invoice is not associated with a customer" },
          { status: 400 }
        );
      }

      // Create CREDIT transaction for customer (reduces their debt)
      await addCustomerTransaction(
        prisma,
        invoice.customerId,
        'CREDIT',
        paymentAmountNum,
        description || `Payment for invoice ${invoiceNumber}`,
        reference || invoiceNumber
      );

             // Create CREDIT transaction for company (we receive money)
       await addCompanyTransaction(
         prisma,
         'CREDIT',
         paymentAmountNum,
         `Customer payment for invoice ${invoiceNumber}`,
         reference || invoiceNumber
       );

    } else if (paymentType === "VENDOR_PAYMENT") {
      // We are paying the vendor
      if (!invoice.vendorId) {
        return NextResponse.json(
          { error: "This invoice is not associated with a vendor" },
          { status: 400 }
        );
      }

      // Create CREDIT transaction for vendor (reduces our debt to them)
      await addVendorTransaction(
        prisma,
        invoice.vendorId,
        'CREDIT',
        paymentAmountNum,
        description || `Payment for invoice ${invoiceNumber}`,
        reference || invoiceNumber
      );

             // Create DEBIT transaction for company (we pay money out to vendor)
       await addCompanyTransaction(
         prisma,
         'DEBIT',
         paymentAmountNum,
         `Vendor payment for invoice ${invoiceNumber}`,
         reference || invoiceNumber
       );
     }

         // Create payment record
     const payment = await prisma.payment.create({
       data: {
         transactionType: paymentType === "CUSTOMER_PAYMENT" ? "INCOME" : "EXPENSE",
         category: paymentType === "CUSTOMER_PAYMENT" ? "Customer Payment" : "Vendor Payment",
         date: new Date(),
         currency: "USD",
         amount: paymentAmountNum,
         fromPartyType: paymentType === "CUSTOMER_PAYMENT" ? "CUSTOMER" : "US",
         fromCustomerId: paymentType === "CUSTOMER_PAYMENT" ? invoice.customerId : null,
         fromCustomer: paymentType === "CUSTOMER_PAYMENT" ? invoice.customer?.CompanyName || "" : "",
         toPartyType: paymentType === "CUSTOMER_PAYMENT" ? "US" : "VENDOR",
         toVendorId: paymentType === "VENDOR_PAYMENT" ? invoice.vendorId : null,
         toVendor: paymentType === "VENDOR_PAYMENT" ? invoice.vendor?.CompanyName || "" : "",
         mode: paymentMethod || "CASH",
         reference: reference || invoiceNumber,
         description: description || `Payment for invoice ${invoiceNumber}`
       }
     });

     // Calculate invoice payment status and update
     const paymentStatus = await calculateInvoicePaymentStatus(
       prisma,
       invoiceNumber,
       invoice.totalAmount
     );

     // Update invoice status based on total payments
     await prisma.invoice.update({
       where: { invoiceNumber },
       data: { 
         status: paymentStatus.status
       }
     });

     return NextResponse.json({
       success: true,
       message: "Payment processed successfully",
       payment,
       invoice: {
         invoiceNumber: invoice.invoiceNumber,
         status: paymentStatus.status,
         totalPaid: paymentStatus.totalPaid,
         remainingAmount: paymentStatus.remainingAmount,
         totalAmount: paymentStatus.totalAmount
       }
     });

  } catch (error) {
    console.error("Error processing payment:", error);
    return NextResponse.json(
      { error: "Failed to process payment" },
      { status: 500 }
    );
  }
}
