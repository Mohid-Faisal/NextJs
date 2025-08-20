import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCustomerTransaction, addVendorTransaction, calculateInvoicePaymentStatus } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      invoiceNumber, 
      paymentAmount, 
      paymentType, // "CUSTOMER_PAYMENT" or "VENDOR_PAYMENT"
      paymentMethod,
      reference,
      description,
      debitAccountId,
      creditAccountId
    } = body;

    if (!invoiceNumber || !paymentAmount || !paymentType || !reference) {
      return NextResponse.json(
        { error: "Invoice number, payment amount, payment type, and reference are required" },
        { status: 400 }
      );
    }

    // Validate chart of accounts
    if (!debitAccountId || !creditAccountId) {
      return NextResponse.json(
        { error: "Both debit and credit accounts are required" },
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

      // Calculate how much is still owed on this invoice
      const totalPaidSoFar = await prisma.payment.aggregate({
        where: {
          invoice: invoiceNumber,
          transactionType: "INCOME"
        },
        _sum: {
          amount: true
        }
      });

      const alreadyPaid = totalPaidSoFar._sum.amount || 0;
      const remainingAmount = Math.max(0, invoice.totalAmount - alreadyPaid);
      
      // Determine how much goes to the invoice and how much becomes credit
      const amountForInvoice = Math.min(paymentAmountNum, remainingAmount);
      const overpaymentAmount = Math.max(0, paymentAmountNum - remainingAmount);

      console.log(`Customer payment calculation for invoice ${invoiceNumber}:`, {
        invoiceAmount: invoice.totalAmount,
        alreadyPaid,
        remainingAmount,
        paymentAmount: paymentAmountNum,
        amountForInvoice,
        overpaymentAmount
      });

      // Create CREDIT transaction for customer for the invoice payment portion
      await addCustomerTransaction(
        prisma,
        invoice.customerId,
        'CREDIT',
        amountForInvoice,
        description || `Payment for invoice ${invoiceNumber}`,
        reference,
        invoiceNumber
      );

      // Journal entry will be created by createJournalEntryForPaymentProcess

      // If there's an overpayment, create a separate credit transaction for the customer
      if (overpaymentAmount > 0) {
        await addCustomerTransaction(
          prisma,
          invoice.customerId,
          'CREDIT',
          overpaymentAmount,
          `Overpayment credit for invoice ${invoiceNumber}`,
          `CREDIT-${invoiceNumber}`,
          invoiceNumber
        );

        // Journal entry will be created by createJournalEntryForPaymentProcess
      }

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
        reference,
        invoiceNumber
      );

      // Journal entry will be created by createJournalEntryForPaymentProcess
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        transactionType: paymentType === "CUSTOMER_PAYMENT" ? "INCOME" : "EXPENSE",
        category: paymentType === "CUSTOMER_PAYMENT" ? "Customer Payment" : "Vendor Payment",
        date: new Date(),
        amount: paymentAmountNum,
        fromPartyType: paymentType === "CUSTOMER_PAYMENT" ? "CUSTOMER" : "US",
        fromCustomerId: paymentType === "CUSTOMER_PAYMENT" ? invoice.customerId : null,
        fromCustomer: paymentType === "CUSTOMER_PAYMENT" ? invoice.customer?.CompanyName || "" : "",
        toPartyType: paymentType === "CUSTOMER_PAYMENT" ? "US" : "VENDOR",
        toVendorId: paymentType === "VENDOR_PAYMENT" ? invoice.vendorId : null,
        toVendor: paymentType === "VENDOR_PAYMENT" ? invoice.vendor?.CompanyName || "" : "",
        mode: paymentMethod || "CASH",
        reference: reference,
        invoice: invoiceNumber,
        description: description || `Payment for invoice ${invoiceNumber}`
      }
    });

    // Create journal entry for the payment
    await createJournalEntryForPaymentProcess(payment, body, invoice);

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

async function createJournalEntryForPaymentProcess(payment: any, body: any, invoice: any) {
  try {
    // Generate journal entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      orderBy: { entryNumber: "desc" }
    });

    let entryNumber = "JE-0001";
    if (lastEntry) {
      const lastNumber = parseInt(lastEntry.entryNumber.split("-")[1]);
      entryNumber = `JE-${String(lastNumber + 1).padStart(4, "0")}`;
    }

    // Create journal entry with lines
    const journalEntry = await prisma.$transaction(async (tx) => {
      // Create the journal entry
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(),
          description: `Invoice Payment: ${body.paymentType === "CUSTOMER_PAYMENT" ? "Customer" : "Vendor"} payment for ${invoice.invoiceNumber} - ${body.description || 'No description'}`,
          reference: body.reference || `Payment-${payment.id}`,
          totalDebit: Number(body.paymentAmount),
          totalCredit: Number(body.paymentAmount),
          isPosted: true, // Auto-post payment journal entries
          postedAt: new Date()
        }
      });

      // Create the journal entry lines
      await Promise.all([
        // Debit line
        tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            accountId: body.debitAccountId,
            debitAmount: Number(body.paymentAmount),
            creditAmount: 0,
            description: `Debit: ${body.paymentType === "CUSTOMER_PAYMENT" ? "Customer" : "Vendor"} payment`,
            reference: body.reference || `Payment-${payment.id}`
          }
        }),
        // Credit line
        tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            accountId: body.creditAccountId,
            debitAmount: 0,
            creditAmount: Number(body.paymentAmount),
            description: `Credit: ${body.paymentType === "CUSTOMER_PAYMENT" ? "Customer" : "Vendor"} payment`,
            reference: body.reference || `Payment-${payment.id}`
          }
        })
      ]);

      return entry;
    });

    console.log(`Created journal entry ${journalEntry.entryNumber} for payment process ${payment.id}`);
  } catch (error) {
    console.error("Error creating journal entry for payment process:", error);
    throw error;
  }
}
