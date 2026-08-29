import { createJournalEntryForPaymentProcess } from "@/lib/accounts/createJournalEntryForPaymentProcess";
import {
  addCustomerTransaction,
  addVendorTransaction,
} from "@/lib/server/ledger";
import { money } from "@/lib/money";

export type PlannedAllocation = {
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
};

/**
 * FIFO split of an excess amount across outstanding invoices.
 * Pure function — no DB writes. One Payment still records the full cash
 * amount; these rows are how that cash is applied per invoice.
 */
export function planFifoAllocations(
  invoices: Array<{ id: number; invoiceNumber: string; totalAmount: number }>,
  paidById: Map<number, number>,
  excessAmount: number
): PlannedAllocation[] {
  const out: PlannedAllocation[] = [];
  let remaining = excessAmount;
  for (const invoice of invoices) {
    if (remaining <= 0) break;
    const alreadyPaid = paidById.get(invoice.id) ?? 0;
    const due = Math.max(0, money(invoice.totalAmount) - alreadyPaid);
    if (due <= 0) continue;
    const amount = Math.min(remaining, due);
    out.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount,
    });
    remaining -= amount;
  }
  return out;
}

function requireOrgId(organizationId: number | undefined | null): number {
  if (organizationId == null || !Number.isFinite(organizationId)) {
    throw new Error("organizationId is required for invoice payment operations");
  }
  return organizationId;
}

function invoiceWhere(organizationId: number, invoiceNumber: string) {
  return {
    organizationId_invoiceNumber: { organizationId, invoiceNumber },
  };
}

async function paidTotalsForInvoices(
  prisma: any,
  organizationId: number,
  invoices: Array<{ id: number; invoiceNumber: string }>,
  transactionType: "INCOME" | "EXPENSE"
): Promise<Map<number, number>> {
  const totals = new Map<number, number>();
  if (invoices.length === 0) return totals;
  for (const inv of invoices) totals.set(inv.id, 0);

  const ids = invoices.map((i) => i.id);
  const allocRows = await prisma.paymentAllocation.groupBy({
    by: ["invoiceId"],
    where: { organizationId, invoiceId: { in: ids } },
    _sum: { amount: true },
  });
  for (const row of allocRows) {
    totals.set(row.invoiceId, money(row._sum.amount ?? 0));
  }

  const numbers = invoices.map((i) => i.invoiceNumber);
  const legacy = await prisma.payment.findMany({
    where: {
      organizationId,
      transactionType,
      invoice: { in: numbers },
      allocations: { none: {} },
    },
    select: { invoice: true, amount: true },
  });
  const numberToId = new Map(invoices.map((i) => [i.invoiceNumber, i.id]));
  for (const row of legacy) {
    const id = row.invoice ? numberToId.get(row.invoice) : undefined;
    if (id == null) continue;
    totals.set(id, (totals.get(id) ?? 0) + money(row.amount ?? 0));
  }
  return totals;
}

async function persistAllocationsAndStatuses(
  prisma: any,
  organizationId: number,
  paymentId: number,
  items: PlannedAllocation[]
) {
  const positive = items.filter((i) => i.amount > 0);
  if (positive.length > 0) {
    await prisma.paymentAllocation.createMany({
      data: positive.map((i) => ({
        organizationId,
        paymentId,
        invoiceId: i.invoiceId,
        amount: i.amount,
      })),
    });
  }

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.invoiceNumber)) continue;
    seen.add(item.invoiceNumber);
    const invoice = await prisma.invoice.findUnique({
      where: invoiceWhere(organizationId, item.invoiceNumber),
      select: { id: true, totalAmount: true, invoiceNumber: true },
    });
    if (!invoice) continue;
    const paymentStatus = await calculateInvoicePaymentStatus(
      prisma,
      invoice.invoiceNumber,
      money(invoice.totalAmount),
      organizationId,
      invoice.id
    );
    await prisma.invoice.update({
      where: invoiceWhere(organizationId, invoice.invoiceNumber),
      data: { status: paymentStatus.status },
    });
  }
}

async function loadOutstandingInvoices(
  prisma: any,
  organizationId: number,
  paymentType: "CUSTOMER_PAYMENT" | "VENDOR_PAYMENT",
  customerId: number | null,
  vendorId: number | null,
  originalInvoiceNumber: string
) {
  const where =
    paymentType === "CUSTOMER_PAYMENT"
      ? {
          organizationId,
          customerId,
          status: { in: ["Unpaid", "Partial"] },
          invoiceNumber: { not: originalInvoiceNumber },
        }
      : {
          organizationId,
          vendorId,
          status: { in: ["Unpaid", "Partial"] },
          invoiceNumber: { not: originalInvoiceNumber },
        };

  const outstanding = await prisma.invoice.findMany({
    where,
    include: {
      shipment: { select: { shipmentDate: true } },
    },
  });

  outstanding.sort((a: any, b: any) => {
    const dateA = a.shipment?.shipmentDate || a.invoiceDate;
    const dateB = b.shipment?.shipmentDate || b.invoiceDate;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  return outstanding as Array<{
    id: number;
    invoiceNumber: string;
    totalAmount: number;
    invoiceDate: Date;
  }>;
}

export async function allocateExcessPayment(
  prisma: any,
  customerId: number | null,
  vendorId: number | null,
  excessAmount: number,
  originalInvoiceNumber: string,
  paymentReference: string,
  paymentType: "CUSTOMER_PAYMENT" | "VENDOR_PAYMENT",
  _paymentDate?: string | Date,
  organizationId?: number,
  paymentId?: number
) {
  const orgId = requireOrgId(organizationId);
  const outstanding = await loadOutstandingInvoices(
    prisma,
    orgId,
    paymentType,
    customerId,
    vendorId,
    originalInvoiceNumber
  );
  const paidById = await paidTotalsForInvoices(
    prisma,
    orgId,
    outstanding,
    paymentType === "CUSTOMER_PAYMENT" ? "INCOME" : "EXPENSE"
  );
  const planned = planFifoAllocations(
    outstanding.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      totalAmount: money(inv.totalAmount),
    })),
    paidById,
    excessAmount
  );

  let resolvedPaymentId = paymentId;
  if (resolvedPaymentId == null && paymentReference) {
    const existing = await prisma.payment.findFirst({
      where: { organizationId: orgId, reference: paymentReference },
      select: { id: true },
    });
    resolvedPaymentId = existing?.id;
  }

  if (resolvedPaymentId != null) {
    await persistAllocationsAndStatuses(
      prisma,
      orgId,
      resolvedPaymentId,
      planned
    );
  }

  const allocated = planned.reduce((s, p) => s + p.amount, 0);
  return {
    allocations: planned.map((p) => ({
      invoiceNumber: p.invoiceNumber,
      amount: p.amount,
      status: "",
    })),
    remainingUnallocated: Math.max(0, excessAmount - allocated),
    totalAllocated: allocated,
    planned,
  };
}

export async function processPaymentWithAllocation(
  prisma: any,
  invoiceNumber: string,
  paymentAmount: number,
  paymentType: "CUSTOMER_PAYMENT" | "VENDOR_PAYMENT",
  paymentMethod: string,
  reference: string,
  description?: string,
  paymentDate?: string,
  debitAccountId?: number,
  creditAccountId?: number,
  organizationId?: number
) {
  const orgId = requireOrgId(organizationId);
  const paymentAmountNum = parseFloat(paymentAmount.toString());

  return prisma.$transaction(
    async (tx: any) => {
      const invoice = await tx.invoice.findUnique({
        where: invoiceWhere(orgId, invoiceNumber),
        include: { customer: true, vendor: true },
      });
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const current = await calculateInvoicePaymentStatus(
        tx,
        invoiceNumber,
        money(invoice.totalAmount),
        orgId,
        invoice.id
      );
      const remainingAmount = Math.max(0, current.remainingAmount);
      const amountForInvoice = Math.min(paymentAmountNum, remainingAmount);
      const overpaymentAmount = Math.max(0, paymentAmountNum - remainingAmount);
      const OVERPAY_THRESHOLD = 0.01;

      const planned: PlannedAllocation[] = [];
      if (amountForInvoice > 0) {
        planned.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: amountForInvoice,
        });
      }

      let allocationResult: Awaited<ReturnType<typeof allocateExcessPayment>> | null =
        null;
      if (overpaymentAmount > OVERPAY_THRESHOLD) {
        if (paymentType === "CUSTOMER_PAYMENT" && !invoice.customerId) {
          throw new Error("This invoice is not associated with a customer");
        }
        if (paymentType === "VENDOR_PAYMENT" && !invoice.vendorId) {
          throw new Error("This invoice is not associated with a vendor");
        }
        allocationResult = await allocateExcessPayment(
          tx,
          invoice.customerId,
          invoice.vendorId,
          overpaymentAmount,
          invoiceNumber,
          reference,
          paymentType,
          paymentDate,
          orgId
        );
        planned.push(...(allocationResult.planned ?? []));
      }

      if (paymentType === "CUSTOMER_PAYMENT") {
        if (!invoice.customerId) {
          throw new Error("This invoice is not associated with a customer");
        }
        if (paymentAmountNum > 0) {
          await addCustomerTransaction(
            tx,
            invoice.customerId,
            "CREDIT",
            paymentAmountNum,
            description || `Payment for invoice ${invoiceNumber}`,
            reference,
            invoiceNumber,
            paymentDate,
            orgId
          );
        }
      } else {
        if (!invoice.vendorId) {
          throw new Error("This invoice is not associated with a vendor");
        }
        if (paymentAmountNum > 0) {
          await addVendorTransaction(
            tx,
            invoice.vendorId,
            "CREDIT",
            paymentAmountNum,
            description || `Payment for invoice ${invoiceNumber}`,
            reference,
            invoiceNumber,
            paymentDate,
            orgId
          );
        }
      }

      let paymentDescription = description || `Payment for invoice ${invoiceNumber}`;
      if (allocationResult && allocationResult.allocations.length > 0) {
        const allocationDetails = allocationResult.allocations
          .map((alloc) => `${alloc.invoiceNumber}:${alloc.amount.toFixed(2)}`)
          .join("|");
        paymentDescription += ` | ALLOCATIONS:${allocationDetails}`;
      }

      const payment = await tx.payment.create({
        data: {
          organizationId: orgId,
          transactionType: paymentType === "CUSTOMER_PAYMENT" ? "INCOME" : "EXPENSE",
          category:
            paymentType === "CUSTOMER_PAYMENT"
              ? "Customer Payment"
              : "Vendor Payment",
          date: paymentDate ? new Date(paymentDate) : new Date(),
          amount: paymentAmountNum,
          fromPartyType: paymentType === "CUSTOMER_PAYMENT" ? "CUSTOMER" : "US",
          fromCustomerId:
            paymentType === "CUSTOMER_PAYMENT" ? invoice.customerId : null,
          fromCustomer:
            paymentType === "CUSTOMER_PAYMENT"
              ? invoice.customer?.CompanyName || ""
              : "",
          toPartyType: paymentType === "CUSTOMER_PAYMENT" ? "US" : "VENDOR",
          toVendorId: paymentType === "VENDOR_PAYMENT" ? invoice.vendorId : null,
          toVendor:
            paymentType === "VENDOR_PAYMENT"
              ? invoice.vendor?.CompanyName || ""
              : "",
          mode: paymentMethod || "CASH",
          reference,
          invoice: invoiceNumber,
          description: paymentDescription,
        },
      });

      await persistAllocationsAndStatuses(tx, orgId, payment.id, planned);

      if (debitAccountId && creditAccountId) {
        await createJournalEntryForPaymentProcess(
          payment,
          {
            paymentAmount: paymentAmountNum,
            paymentType,
            description,
            paymentDate,
            debitAccountId,
            creditAccountId,
            reference,
          },
          { invoiceNumber: invoice.invoiceNumber },
          orgId,
          tx
        );
      }

      const paymentStatus = await calculateInvoicePaymentStatus(
        tx,
        invoiceNumber,
        money(invoice.totalAmount),
        orgId,
        invoice.id
      );

      return {
        payment,
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          status: paymentStatus.status,
          totalPaid: paymentStatus.totalPaid,
          remainingAmount: paymentStatus.remainingAmount,
          totalAmount: paymentStatus.totalAmount,
        },
        allocation: allocationResult,
      };
    },
    { timeout: 30000, maxWait: 10000 }
  );
}

export async function calculateInvoicePaymentStatus(
  prisma: any,
  invoiceNumber: string,
  invoiceAmount: number,
  organizationId?: number,
  invoiceId?: number
) {
  const orgId = requireOrgId(organizationId);
  let resolvedId = invoiceId;
  let amount = money(invoiceAmount);

  if (resolvedId == null) {
    const invoice = await prisma.invoice.findUnique({
      where: invoiceWhere(orgId, invoiceNumber),
      select: { id: true, totalAmount: true },
    });
    if (!invoice) {
      return {
        status: "Unpaid",
        totalPaid: 0,
        remainingAmount: amount,
        totalAmount: amount,
      };
    }
    resolvedId = invoice.id;
    amount = money(invoice.totalAmount);
  }

  const allocationSum = await prisma.paymentAllocation.aggregate({
    where: { organizationId: orgId, invoiceId: resolvedId },
    _sum: { amount: true },
  });
  let totalPaid = money(allocationSum._sum.amount || 0);

  const legacy = await prisma.payment.findMany({
    where: {
      organizationId: orgId,
      invoice: invoiceNumber,
      allocations: { none: {} },
    },
    select: { amount: true },
  });
  for (const row of legacy) {
    totalPaid += money(row.amount || 0);
  }

  const remainingAmount = Math.max(0, amount - totalPaid);
  let status = "Unpaid";
  if (totalPaid >= amount && amount > 0) {
    status = "Paid";
  } else if (totalPaid > 0) {
    status = "Partial";
  }

  return {
    status,
    totalPaid,
    remainingAmount,
    totalAmount: amount,
  };
}
