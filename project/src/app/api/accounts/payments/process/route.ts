import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  addCustomerTransaction,
  addVendorTransaction,
  calculateInvoicePaymentStatus,
  processPaymentWithAllocation,
} from "@/lib/utils";
import { createJournalEntryForPaymentProcess } from "@/lib/accounts/createJournalEntryForPaymentProcess";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgInvoiceByNumber } from "@/lib/tenant/findOrgPayment";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json();
    const {
      invoiceNumber,
      paymentAmount,
      paymentType,
      paymentMethod,
      reference,
      description,
      paymentDate,
      debitAccountId,
      creditAccountId,
      enableAllocation = true,
    } = body;

    if (!invoiceNumber || !paymentAmount || !paymentType || !reference) {
      return NextResponse.json(
        { error: "Invoice number, payment amount, payment type, and reference are required" },
        { status: 400 }
      );
    }

    if (!debitAccountId || !creditAccountId) {
      return NextResponse.json(
        { error: "Both debit and credit accounts are required" },
        { status: 400 }
      );
    }

    const invoiceCheck = await findOrgInvoiceByNumber(session, invoiceNumber);
    if (!invoiceCheck) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (enableAllocation) {
      const result = await processPaymentWithAllocation(
        prisma,
        invoiceNumber,
        paymentAmount,
        paymentType,
        paymentMethod || "CASH",
        reference,
        description,
        paymentDate,
        debitAccountId,
        creditAccountId,
        session.organizationId
      );

      await createJournalEntryForPaymentProcess(result.payment, body, result.invoice, session.organizationId);

      return NextResponse.json({
        success: true,
        message: "Payment processed successfully with automatic allocation",
        payment: result.payment,
        invoice: result.invoice,
        allocation: result.allocation,
      });
    }

    const invoice = invoiceCheck;
    const paymentAmountNum = parseFloat(paymentAmount);

    if (paymentType === "CUSTOMER_PAYMENT") {
      if (!invoice.customerId) {
        return NextResponse.json(
          { error: "This invoice is not associated with a customer" },
          { status: 400 }
        );
      }

      const totalPaidSoFar = await prisma.payment.aggregate({
        where: orgWhere(session, {
          invoice: invoiceNumber,
          transactionType: "INCOME",
        }),
        _sum: { amount: true },
      });

      const alreadyPaid = totalPaidSoFar._sum.amount || 0;
      const remainingAmount = Math.max(0, invoice.totalAmount - alreadyPaid);
      const amountForInvoice = Math.min(paymentAmountNum, remainingAmount);
      const overpaymentAmount = Math.max(0, paymentAmountNum - remainingAmount);

      await addCustomerTransaction(
        prisma,
        invoice.customerId,
        "CREDIT",
        amountForInvoice,
        description || `Payment for invoice ${invoiceNumber}`,
        reference,
        invoiceNumber,
        paymentDate,
        session.organizationId
      );

      if (overpaymentAmount > 0) {
        await addCustomerTransaction(
          prisma,
          invoice.customerId,
          "CREDIT",
          overpaymentAmount,
          `Overpayment credit for invoice ${invoiceNumber}`,
          `CREDIT-${invoiceNumber}`,
          invoiceNumber,
          paymentDate,
          session.organizationId
        );
      }
    } else if (paymentType === "VENDOR_PAYMENT") {
      if (!invoice.vendorId) {
        return NextResponse.json(
          { error: "This invoice is not associated with a vendor" },
          { status: 400 }
        );
      }

      await addVendorTransaction(
        prisma,
        invoice.vendorId,
        "CREDIT",
        paymentAmountNum,
        description || `Payment for invoice ${invoiceNumber}`,
        reference,
        invoiceNumber,
        paymentDate,
        session.organizationId
      );
    }

    const payment = await prisma.payment.create({
      data: orgData(session, {
        transactionType: paymentType === "CUSTOMER_PAYMENT" ? "INCOME" : "EXPENSE",
        category: paymentType === "CUSTOMER_PAYMENT" ? "Customer Payment" : "Vendor Payment",
        date: paymentDate ? new Date(paymentDate) : new Date(),
        amount: paymentAmountNum,
        fromPartyType: paymentType === "CUSTOMER_PAYMENT" ? "CUSTOMER" : "US",
        fromCustomerId: paymentType === "CUSTOMER_PAYMENT" ? invoice.customerId : null,
        fromCustomer:
          paymentType === "CUSTOMER_PAYMENT" ? invoice.customer?.CompanyName || "" : "",
        toPartyType: paymentType === "CUSTOMER_PAYMENT" ? "US" : "VENDOR",
        toVendorId: paymentType === "VENDOR_PAYMENT" ? invoice.vendorId : null,
        toVendor: paymentType === "VENDOR_PAYMENT" ? invoice.vendor?.CompanyName || "" : "",
        mode: paymentMethod || "CASH",
        reference,
        invoice: invoiceNumber,
        description: description || `Payment for invoice ${invoiceNumber}`,
      }),
    });

    await createJournalEntryForPaymentProcess(payment, body, invoice, session.organizationId);

    const paymentStatus = await calculateInvoicePaymentStatus(
      prisma,
      invoiceNumber,
      invoice.totalAmount
    );

    await prisma.invoice.update({
      where: { invoiceNumber },
      data: { status: paymentStatus.status },
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
        totalAmount: paymentStatus.totalAmount,
      },
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    return NextResponse.json(
      { error: "Failed to process payment" },
      { status: 500 }
    );
  }
}
