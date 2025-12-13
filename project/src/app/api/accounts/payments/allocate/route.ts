import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allocateExcessPayment } from "@/lib/utils";

/**
 * POST /api/accounts/payments/allocate
 * Manually allocate excess payments to other outstanding invoices
 * 
 * This endpoint allows manual allocation of excess payments when automatic
 * allocation is disabled or when you want to reallocate existing credits.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      customerId,
      vendorId,
      excessAmount,
      originalInvoiceNumber,
      paymentReference,
      paymentType, // "CUSTOMER_PAYMENT" or "VENDOR_PAYMENT"
      paymentDate, // Optional: payment date for allocation transactions
      specificInvoices = [] // Optional: specific invoices to allocate to
    } = body;

    if (!excessAmount || !originalInvoiceNumber || !paymentReference || !paymentType) {
      return NextResponse.json(
        { error: "Excess amount, original invoice number, payment reference, and payment type are required" },
        { status: 400 }
      );
    }

    if (paymentType === "CUSTOMER_PAYMENT" && !customerId) {
      return NextResponse.json(
        { error: "Customer ID is required for customer payment allocation" },
        { status: 400 }
      );
    }

    if (paymentType === "VENDOR_PAYMENT" && !vendorId) {
      return NextResponse.json(
        { error: "Vendor ID is required for vendor payment allocation" },
        { status: 400 }
      );
    }

    const excessAmountNum = parseFloat(excessAmount.toString());

    if (excessAmountNum <= 0) {
      return NextResponse.json(
        { error: "Excess amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Perform the allocation
    const allocationResult = await allocateExcessPayment(
      prisma,
      customerId,
      vendorId,
      excessAmountNum,
      originalInvoiceNumber,
      paymentReference,
      paymentType,
      paymentDate
    );

    return NextResponse.json({
      success: true,
      message: "Payment allocation completed successfully",
      allocation: allocationResult
    });

  } catch (error) {
    console.error("Error allocating payment:", error);
    return NextResponse.json(
      { error: "Failed to allocate payment" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/accounts/payments/allocate
 * Get outstanding invoices for a customer or vendor to show allocation options
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const vendorId = searchParams.get("vendorId");
    const paymentType = searchParams.get("paymentType");

    if (!customerId && !vendorId) {
      return NextResponse.json(
        { error: "Either customerId or vendorId is required" },
        { status: 400 }
      );
    }

    let outstandingInvoices: any[] = [];

    if (paymentType === "CUSTOMER_PAYMENT" && customerId) {
      const customerInvoices = await prisma.invoice.findMany({
        where: {
          customerId: parseInt(customerId),
          status: { in: ['Unpaid', 'Partial'] }
        },
        orderBy: { invoiceDate: 'asc' },
        include: {
          customer: true
        }
      });

      // Calculate remaining amounts for each invoice
      for (const invoice of customerInvoices) {
        const totalPaid = await prisma.payment.aggregate({
          where: {
            invoice: invoice.invoiceNumber,
            transactionType: 'INCOME'
          },
          _sum: { amount: true }
        });

        const alreadyPaid = totalPaid._sum.amount || 0;
        const remainingAmount = Math.max(0, invoice.totalAmount - alreadyPaid);
        
        outstandingInvoices.push({
          ...invoice,
          remainingAmount
        });
      }

    } else if (paymentType === "VENDOR_PAYMENT" && vendorId) {
      const vendorInvoices = await prisma.invoice.findMany({
        where: {
          vendorId: parseInt(vendorId),
          status: { in: ['Unpaid', 'Partial'] }
        },
        orderBy: { invoiceDate: 'asc' },
        include: {
          vendor: true
        }
      });

      // Calculate remaining amounts for each invoice
      for (const invoice of vendorInvoices) {
        const totalPaid = await prisma.payment.aggregate({
          where: {
            invoice: invoice.invoiceNumber,
            transactionType: 'EXPENSE'
          },
          _sum: { amount: true }
        });

        const alreadyPaid = totalPaid._sum.amount || 0;
        const remainingAmount = Math.max(0, invoice.totalAmount - alreadyPaid);
        
        outstandingInvoices.push({
          ...invoice,
          remainingAmount
        });
      }
    }

    // Filter out invoices with no remaining amount
    outstandingInvoices = outstandingInvoices.filter(invoice => invoice.remainingAmount > 0);

    return NextResponse.json({
      success: true,
      outstandingInvoices
    });

  } catch (error) {
    console.error("Error fetching outstanding invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch outstanding invoices" },
      { status: 500 }
    );
  }
}
