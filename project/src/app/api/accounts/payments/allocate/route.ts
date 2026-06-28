import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allocateExcessPayment } from "@/lib/utils";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgInvoiceByNumber } from "@/lib/tenant/findOrgPayment";

/**
 * POST /api/accounts/payments/allocate
 * Manually allocate excess payments to other outstanding invoices
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json();
    const {
      customerId,
      vendorId,
      excessAmount,
      originalInvoiceNumber,
      paymentReference,
      paymentType,
      paymentDate,
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

    const originalInvoice = await findOrgInvoiceByNumber(session, originalInvoiceNumber);
    if (!originalInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (paymentType === "CUSTOMER_PAYMENT") {
      const customer = await prisma.customers.findFirst({
        where: orgWhere(session, { id: parseInt(String(customerId), 10) }),
      });
      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
    } else {
      const vendor = await prisma.vendors.findFirst({
        where: orgWhere(session, { id: parseInt(String(vendorId), 10) }),
      });
      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }
    }

    const excessAmountNum = parseFloat(excessAmount.toString());

    if (excessAmountNum <= 0) {
      return NextResponse.json(
        { error: "Excess amount must be greater than 0" },
        { status: 400 }
      );
    }

    const allocationResult = await allocateExcessPayment(
      prisma,
      customerId ? parseInt(String(customerId), 10) : null,
      vendorId ? parseInt(String(vendorId), 10) : null,
      excessAmountNum,
      originalInvoiceNumber,
      paymentReference,
      paymentType,
      paymentDate,
      session.organizationId
    );

    return NextResponse.json({
      success: true,
      message: "Payment allocation completed successfully",
      allocation: allocationResult,
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
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

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
      const customer = await prisma.customers.findFirst({
        where: orgWhere(session, { id: parseInt(customerId, 10) }),
      });
      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }

      const customerInvoices = await prisma.invoice.findMany({
        where: orgWhere(session, {
          customerId: parseInt(customerId, 10),
          status: { in: ["Unpaid", "Partial"] },
        }),
        orderBy: { invoiceDate: "asc" },
        include: { customer: true },
      });

      for (const invoice of customerInvoices) {
        const totalPaid = await prisma.payment.aggregate({
          where: orgWhere(session, {
            invoice: invoice.invoiceNumber,
            transactionType: "INCOME",
          }),
          _sum: { amount: true },
        });

        const alreadyPaid = totalPaid._sum.amount || 0;
        const remainingAmount = Math.max(0, invoice.totalAmount - alreadyPaid);

        outstandingInvoices.push({
          ...invoice,
          remainingAmount,
        });
      }
    } else if (paymentType === "VENDOR_PAYMENT" && vendorId) {
      const vendor = await prisma.vendors.findFirst({
        where: orgWhere(session, { id: parseInt(vendorId, 10) }),
      });
      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      const vendorInvoices = await prisma.invoice.findMany({
        where: orgWhere(session, {
          vendorId: parseInt(vendorId, 10),
          status: { in: ["Unpaid", "Partial"] },
        }),
        orderBy: { invoiceDate: "asc" },
        include: { vendor: true },
      });

      for (const invoice of vendorInvoices) {
        const totalPaid = await prisma.payment.aggregate({
          where: orgWhere(session, {
            invoice: invoice.invoiceNumber,
            transactionType: "EXPENSE",
          }),
          _sum: { amount: true },
        });

        const alreadyPaid = totalPaid._sum.amount || 0;
        const remainingAmount = Math.max(0, invoice.totalAmount - alreadyPaid);

        outstandingInvoices.push({
          ...invoice,
          remainingAmount,
        });
      }
    }

    outstandingInvoices = outstandingInvoices.filter(
      (invoice) => invoice.remainingAmount > 0
    );

    return NextResponse.json({
      success: true,
      outstandingInvoices,
    });
  } catch (error) {
    console.error("Error fetching outstanding invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch outstanding invoices" },
      { status: 500 }
    );
  }
}
