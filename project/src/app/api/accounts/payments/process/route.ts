import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  addCustomerTransaction,
  addVendorTransaction,
} from "@/lib/server/ledger";
import {
  calculateInvoicePaymentStatus,
  processPaymentWithAllocation,
} from "@/lib/accounts/invoicePayments";
import { createJournalEntryForPaymentProcess } from "@/lib/accounts/createJournalEntryForPaymentProcess";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgInvoiceByNumber } from "@/lib/tenant/findOrgPayment";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_billing");
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

    // SECURITY: reject non-positive amounts (negative values would reverse
    // transactions and corrupt balances).
    const paymentAmountNum = parseFloat(paymentAmount);
    if (!isFinite(paymentAmountNum) || paymentAmountNum <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be a positive number" },
        { status: 400 }
      );
    }

    // SECURITY: journal lines must only reference GL accounts that belong to
    // the caller's organization. Previously any account ID was accepted,
    // allowing cross-tenant postings.
    const [debitAccount, creditAccount] = await Promise.all([
      prisma.chartOfAccount.findFirst({
        where: orgWhere(session, { id: parseInt(debitAccountId, 10) }),
        select: { id: true },
      }),
      prisma.chartOfAccount.findFirst({
        where: orgWhere(session, { id: parseInt(creditAccountId, 10) }),
        select: { id: true },
      }),
    ]);
    if (!debitAccount || !creditAccount) {
      return NextResponse.json(
        { error: "Debit or credit account not found in your organization" },
        { status: 400 }
      );
    }

    const invoiceCheck = await findOrgInvoiceByNumber(session, invoiceNumber);
    if (!invoiceCheck) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Enforce unique reference number per organization if reference is provided
    if (reference && typeof reference === "string" && reference.trim() !== "") {
      const trimmedRef = reference.trim();
      const existingRef = await prisma.payment.findFirst({
        where: orgWhere(session, {
          reference: trimmedRef,
        }),
      });

      if (existingRef) {
        return NextResponse.json(
          {
            error: `A transaction with reference "${trimmedRef}" already exists (Transaction #${existingRef.id}). Reference number must be unique.`,
          },
          { status: 400 }
        );
      }
    }

    // Deduplication check: if identical payment created in last 10 seconds, return existing payment
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const existingDuplicate = await prisma.payment.findFirst({
      where: orgWhere(session, {
        amount: parseFloat(paymentAmount),
        reference: reference || null,
        invoice: invoiceNumber,
        createdAt: { gte: tenSecondsAgo }
      })
    });
    if (existingDuplicate) {
      console.log(`[POST /api/accounts/payments/process] Deduplication triggered: returning existing payment ID ${existingDuplicate.id}`);
      return NextResponse.json({
        success: true,
        message: "Payment processed successfully",
        payment: existingDuplicate,
      });
    }

    if (enableAllocation) {
      const result = await processPaymentWithAllocation(
        prisma,
        invoiceNumber,
        paymentAmountNum,
        paymentType,
        paymentMethod || "CASH",
        reference,
        description,
        paymentDate,
        debitAccount.id,
        creditAccount.id,
        session.organizationId
      );

      await audit(session, req, "payment.processed", "Payment", result.payment.id, {
        invoiceNumber,
        amount: paymentAmountNum,
        paymentType,
        reference,
        allocation: true,
      });

      return NextResponse.json({
        success: true,
        message: "Payment processed successfully with automatic allocation",
        payment: result.payment,
        invoice: result.invoice,
        allocation: result.allocation,
      });
    }

    const invoice = invoiceCheck;

    const result = await prisma.$transaction(
      async (tx) => {
        if (paymentType === "CUSTOMER_PAYMENT") {
          if (!invoice.customerId) {
            throw new Error("This invoice is not associated with a customer");
          }

          const current = await calculateInvoicePaymentStatus(
            tx,
            invoiceNumber,
            invoice.totalAmount,
            session.organizationId,
            invoice.id
          );
          const remainingAmount = Math.max(0, current.remainingAmount);
          const amountForInvoice = Math.min(paymentAmountNum, remainingAmount);
          const overpaymentAmount = Math.max(0, paymentAmountNum - remainingAmount);

          await addCustomerTransaction(
            tx,
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
              tx,
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
            throw new Error("This invoice is not associated with a vendor");
          }

          await addVendorTransaction(
            tx,
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

        const payment = await tx.payment.create({
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

        const statusBefore = await calculateInvoicePaymentStatus(
          tx,
          invoiceNumber,
          invoice.totalAmount,
          session.organizationId,
          invoice.id
        );
        const applyAmount = Math.min(
          paymentAmountNum,
          Math.max(0, statusBefore.remainingAmount)
        );
        if (applyAmount > 0) {
          await tx.paymentAllocation.create({
            data: {
              organizationId: session.organizationId,
              paymentId: payment.id,
              invoiceId: invoice.id,
              amount: applyAmount,
            },
          });
        }

        await createJournalEntryForPaymentProcess(
          payment,
          {
            paymentAmount: paymentAmountNum,
            paymentType,
            description,
            paymentDate,
            debitAccountId: debitAccount.id,
            creditAccountId: creditAccount.id,
            reference,
          },
          invoice,
          session.organizationId,
          tx
        );

        const paymentStatus = await calculateInvoicePaymentStatus(
          tx,
          invoiceNumber,
          invoice.totalAmount,
          session.organizationId,
          invoice.id
        );

        await tx.invoice.update({
          where: {
            organizationId_invoiceNumber: {
              organizationId: session.organizationId,
              invoiceNumber,
            },
          },
          data: { status: paymentStatus.status },
        });

        return { payment, paymentStatus };
      },
      { timeout: 30000, maxWait: 10000 }
    );

    await audit(session, req, "payment.processed", "Payment", result.payment.id, {
      invoiceNumber,
      amount: paymentAmountNum,
      paymentType,
      reference,
    });

    return NextResponse.json({
      success: true,
      message: "Payment processed successfully",
      payment: result.payment,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        status: result.paymentStatus.status,
        totalPaid: result.paymentStatus.totalPaid,
        remainingAmount: result.paymentStatus.remainingAmount,
        totalAmount: result.paymentStatus.totalAmount,
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
