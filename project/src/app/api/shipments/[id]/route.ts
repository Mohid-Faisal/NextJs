import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createJournalEntryForTransaction } from "@/lib/utils";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "view_shipments");
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const shipmentId = parseInt(id);

    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { error: "Invalid shipment ID" },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findFirst({
      where: orgWhere(session, { id: shipmentId }),
      include: {
        invoices: {
          where: { profile: "Customer" },
          include: { customer: true },
          take: 1,
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Prefer customer linked via invoice; otherwise resolve by shipment.senderName.
    // Recipient is looked up using multiple strategies because
    // shipment.recipientName can be either a company name OR a person name
    // depending on how the shipment was created. All lookups are independent,
    // so they run in parallel and results are picked in priority order.
    let customer = shipment.invoices?.[0]?.customer ?? null;
    let recipient = null;

    const senderName =
      !customer && shipment.senderName ? String(shipment.senderName).trim() : "";
    const recipientName = shipment.recipientName
      ? String(shipment.recipientName).trim()
      : "";

    const [customerMatches, recipientMatches] = await Promise.all([
      senderName
        ? Promise.all([
            prisma.customers.findFirst({
              where: orgWhere(session, { CompanyName: { equals: senderName } }),
            }),
            prisma.customers.findFirst({
              where: orgWhere(session, { PersonName: { equals: senderName } }),
            }),
            prisma.customers.findFirst({
              where: orgWhere(session, {
                OR: [
                  { CompanyName: { contains: senderName } },
                  { PersonName: { contains: senderName } },
                ],
              }),
            }),
          ])
        : Promise.resolve(null),
      recipientName
        ? Promise.all([
            prisma.recipients.findFirst({
              where: orgWhere(session, { CompanyName: { equals: recipientName } }),
            }),
            prisma.recipients.findFirst({
              where: orgWhere(session, { PersonName: { equals: recipientName } }),
            }),
            prisma.recipients.findFirst({
              where: orgWhere(session, {
                OR: [
                  { CompanyName: { contains: recipientName } },
                  { PersonName: { contains: recipientName } },
                ],
              }),
            }),
          ])
        : Promise.resolve(null),
    ]);

    if (customerMatches) {
      customer = customerMatches[0] || customerMatches[1] || customerMatches[2];
    }
    if (recipientMatches) {
      recipient =
        recipientMatches[0] || recipientMatches[1] || recipientMatches[2];
    }

    return NextResponse.json({
      shipment,
      customer,
      recipient,
    });
  } catch (error) {
    console.error("Error fetching shipment:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "delete_shipment");
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const shipmentId = parseInt(id);

    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { error: "Invalid shipment ID" },
        { status: 400 }
      );
    }

    // SECURITY: identity now comes from the validated session instead of a
    // raw Bearer token decode (works with httpOnly cookie sessions).
    const decodedId = session.userId;

    // Get the request body for password and verification code
    const body: { password: string; verificationCode?: string } =
      await request.json();
    const { password, verificationCode } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required for deletion" },
        { status: 400 }
      );
    }

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { id: decodedId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    // For shipments, require 2FA verification
    if (!verificationCode) {
      return NextResponse.json(
        { error: "Verification code is required for shipment deletion" },
        { status: 400 }
      );
    }

    // Verify the 2FA code
    if (user.status.startsWith("PENDING_2FA_")) {
      const statusParts = user.status.split("_");
      const storedCode = statusParts[2];
      const timestamp = parseInt(statusParts[3]);
      const currentTime = Date.now();

      // Check if code has expired (10 minutes)
      if (currentTime - timestamp > 10 * 60 * 1000) {
        // Reset user status and return error
        await prisma.user.update({
          where: { id: user.id },
          data: { status: "ACTIVE" },
        });
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new one." },
          { status: 400 }
        );
      }

      // Verify the code
      if (verificationCode !== storedCode) {
        return NextResponse.json(
          { error: "Invalid verification code" },
          { status: 401 }
        );
      }

      // NOTE: We intentionally do NOT reset user status to ACTIVE here.
      // During bulk delete, multiple requests share the same 2FA code.
      // The code will naturally expire after 10 minutes, and login/session
      // handlers already allow PENDING_2FA_ status.
    } else {
      return NextResponse.json(
        {
          error:
            "No pending verification found. Please request a new verification code.",
        },
        { status: 400 }
      );
    }

    // Check if shipment exists and get related invoices
    const shipment = await prisma.shipment.findFirst({
      where: orgWhere(session, { id: shipmentId }),
      include: {
        // Include invoices to handle financial transactions
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Pre-compute non-null values for use across multiple where clauses
    const trackingId = shipment.trackingId ?? "";
    const invoiceNumber = shipment.invoiceNumber ?? "";
    const invoiceNumberInt = invoiceNumber ? parseInt(invoiceNumber, 10) : NaN;
    const vendorInvoiceNumber = Number.isFinite(invoiceNumberInt)
      ? (invoiceNumberInt + 2).toString()
      : "";

    // Find related invoices
    const invoiceOr: any[] = [{ shipmentId: shipmentId }];
    if (trackingId) invoiceOr.push({ trackingNumber: trackingId });
    if (invoiceNumber) invoiceOr.push({ invoiceNumber: invoiceNumber });

    const relatedInvoices = await prisma.invoice.findMany({
      where: orgWhere(session, { OR: invoiceOr }),
      include: {
        customer: true,
        vendor: true,
      },
    });

    // Find related journal entries that were created for this shipment
    const allInvoiceNumbers = Array.from(
      new Set(
        [
          invoiceNumber,
          vendorInvoiceNumber,
          ...relatedInvoices.map((inv) => inv.invoiceNumber),
        ].filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      )
    );

    const journalEntryOr: any[] = [];
    if (allInvoiceNumbers.length > 0) {
      journalEntryOr.push({ reference: { in: allInvoiceNumbers } });
      allInvoiceNumbers.forEach((invNum) => {
        journalEntryOr.push({ reference: `CREDIT-${invNum}` });
      });
    }
    if (trackingId) {
      journalEntryOr.push({ reference: trackingId });
      journalEntryOr.push({ description: `Customer invoice for shipment ${trackingId}` });
      journalEntryOr.push({ description: `Vendor invoice for shipment ${trackingId}` });
    }

    const relatedJournalEntries = journalEntryOr.length
      ? await prisma.journalEntry.findMany({
          where: orgWhere(session, { OR: journalEntryOr }),
          include: { lines: true },
        })
      : [];

    const customerInvoiceNumbers = Array.from(
      new Set(
        relatedInvoices
          .filter((inv) => inv.profile === "Customer")
          .map((inv) => inv.invoiceNumber)
      )
    );

    const customerTxnOr: any[] = [];
    if (customerInvoiceNumbers.length > 0) {
      customerTxnOr.push({ invoice: { in: customerInvoiceNumbers } });
      customerTxnOr.push({ reference: { in: customerInvoiceNumbers } });
      customerTxnOr.push({
        reference: { in: customerInvoiceNumbers.map((n) => `CREDIT-${n}`) },
      });
    }
    if (trackingId) {
      customerTxnOr.push({ reference: trackingId });
    }

    const relatedCustomerTransactions = customerTxnOr.length
      ? await prisma.customerTransaction.findMany({
          where: orgWhere(session, { OR: customerTxnOr }),
        })
      : [];

    const vendorInvoiceNumbers = Array.from(
      new Set([
        ...relatedInvoices
          .filter((inv) => inv.profile === "Vendor")
          .map((inv) => inv.invoiceNumber),
        ...(vendorInvoiceNumber ? [vendorInvoiceNumber] : []),
      ])
    );

    const vendorTxnOr: any[] = [];
    if (vendorInvoiceNumbers.length > 0) {
      vendorTxnOr.push({ invoice: { in: vendorInvoiceNumbers } });
      vendorTxnOr.push({ reference: { in: vendorInvoiceNumbers } });
      vendorTxnOr.push({
        reference: { in: vendorInvoiceNumbers.map((n) => `CREDIT-${n}`) },
      });
    }
    if (trackingId) {
      vendorTxnOr.push({ reference: trackingId });
    }

    const relatedVendorTransactions = vendorTxnOr.length
      ? await prisma.vendorTransaction.findMany({
          where: orgWhere(session, { OR: vendorTxnOr }),
        })
      : [];

    const unpaidCustomerTransactions = relatedCustomerTransactions.filter(
      (t) => {
        const normalizedRef = t.reference
          ? t.reference.replace(/^(CREDIT|REFUND)-/, "")
          : null;
        const relatedInvoice = relatedInvoices.find(
          (inv) =>
            (t.invoice && inv.invoiceNumber === t.invoice) ||
            (normalizedRef && inv.invoiceNumber === normalizedRef) ||
            (t.reference && inv.trackingNumber === t.reference)
        );
        return !relatedInvoice || relatedInvoice.status !== "Paid";
      }
    );

    const unpaidVendorTransactions = relatedVendorTransactions.filter((t) => {
      const normalizedRef = t.reference
        ? t.reference.replace(/^(CREDIT|REFUND)-/, "")
        : null;
      const relatedInvoice = relatedInvoices.find(
        (inv) =>
          (t.invoice && inv.invoiceNumber === t.invoice) ||
          (normalizedRef && inv.invoiceNumber === normalizedRef) ||
          (t.reference && inv.trackingNumber === t.reference)
      );
      return !relatedInvoice || relatedInvoice.status !== "Paid";
    });

    let customerRefundsProcessed = 0;
    let vendorAdjustmentsProcessed = 0;
    let totalRefundAmount = 0;
    let totalAdjustmentAmount = 0;
    let customerBalancesRecalculated = 0;
    let vendorBalancesRecalculated = 0;

    // ATOMIC CASCADE DELETION: Execute all deletions, balance recalculations,
    // and financial refund postings inside a single database transaction.
    await prisma.$transaction(
      async (tx) => {
        // 1. Delete related journal entries (lines first)
        if (relatedJournalEntries.length > 0) {
          const journalEntryIds = relatedJournalEntries.map((entry) => entry.id);
          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: { in: journalEntryIds } },
          });
          await tx.journalEntry.deleteMany({
            where: { id: { in: journalEntryIds } },
          });
        }

        // 2. Financial adjustments for paid invoices
        for (const invoice of relatedInvoices) {
          if (invoice.status === "Paid" && invoice.totalAmount > 0) {
            if (invoice.profile === "Customer" && invoice.customerId) {
              const customer = await tx.customers.findFirst({
                where: orgWhere(session, { id: invoice.customerId }),
              });
              if (customer) {
                const previousBalance = customer.currentBalance || 0;
                const newBalance = previousBalance + invoice.totalAmount;
                await tx.customerTransaction.create({
                  data: orgData(session, {
                    customerId: invoice.customerId,
                    type: "CREDIT",
                    amount: invoice.totalAmount,
                    description: `Refund for deleted shipment ${shipment.trackingId}`,
                    reference: `REFUND-${invoice.invoiceNumber}`,
                    invoice: invoice.invoiceNumber,
                    previousBalance,
                    newBalance,
                    createdAt: new Date(),
                  }),
                });
                await tx.customers.update({
                  where: { id: invoice.customerId },
                  data: { currentBalance: newBalance },
                });
                customerRefundsProcessed++;
                totalRefundAmount += invoice.totalAmount;
              }
            } else if (invoice.profile === "Vendor" && invoice.vendorId) {
              const vendor = await tx.vendors.findFirst({
                where: orgWhere(session, { id: invoice.vendorId }),
              });
              if (vendor) {
                const previousBalance = vendor.currentBalance || 0;
                const newBalance = previousBalance - invoice.totalAmount;
                await tx.vendorTransaction.create({
                  data: orgData(session, {
                    vendorId: invoice.vendorId,
                    type: "CREDIT",
                    amount: invoice.totalAmount,
                    description: `Payment adjustment for deleted shipment ${shipment.trackingId}`,
                    reference: `ADJUST-${invoice.invoiceNumber}`,
                    invoice: invoice.invoiceNumber,
                    previousBalance,
                    newBalance,
                    createdAt: new Date(),
                  }),
                });
                await tx.vendors.update({
                  where: { id: invoice.vendorId },
                  data: { currentBalance: newBalance },
                });
                vendorAdjustmentsProcessed++;
                totalAdjustmentAmount += invoice.totalAmount;
              }
            }
          }
        }

        // 3. Delete unpaid customer transactions & recalculate customer balances
        if (unpaidCustomerTransactions.length > 0) {
          await tx.customerTransaction.deleteMany({
            where: { id: { in: unpaidCustomerTransactions.map((t) => t.id) } },
          });
          const affectedCustomers = new Set(
            unpaidCustomerTransactions.map((t) => t.customerId)
          );
          for (const customerId of affectedCustomers) {
            const remainingTransactions = await tx.customerTransaction.findMany({
              where: orgWhere(session, { customerId }),
              orderBy: { createdAt: "asc" },
            });
            let newBalance = 0;
            for (const transaction of remainingTransactions) {
              if (transaction.type === "DEBIT") newBalance -= transaction.amount;
              else if (transaction.type === "CREDIT") newBalance += transaction.amount;
            }
            await tx.customers.update({
              where: { id: customerId },
              data: { currentBalance: newBalance },
            });
            customerBalancesRecalculated++;
          }
        }

        // 4. Delete unpaid vendor transactions & recalculate vendor balances
        if (unpaidVendorTransactions.length > 0) {
          await tx.vendorTransaction.deleteMany({
            where: { id: { in: unpaidVendorTransactions.map((t) => t.id) } },
          });
          const affectedVendors = new Set(
            unpaidVendorTransactions.map((t) => t.vendorId)
          );
          for (const vendorId of affectedVendors) {
            const remainingTransactions = await tx.vendorTransaction.findMany({
              where: orgWhere(session, { vendorId }),
              orderBy: { createdAt: "asc" },
            });
            let newBalance = 0;
            for (const transaction of remainingTransactions) {
              if (transaction.type === "DEBIT") newBalance -= transaction.amount;
              else if (transaction.type === "CREDIT") newBalance += transaction.amount;
            }
            await tx.vendors.update({
              where: { id: vendorId },
              data: { currentBalance: newBalance },
            });
            vendorBalancesRecalculated++;
          }
        }

        // 5. Delete related invoices
        if (relatedInvoices.length > 0) {
          await tx.invoice.deleteMany({
            where: orgWhere(session, { OR: invoiceOr }),
          });
        }

        // 6. Delete shipment
        await tx.shipment.delete({
          where: { id: shipmentId },
        });
      },
      { timeout: 30000 }
    );

    return NextResponse.json({
      success: true,
      message: `Shipment deleted successfully. ${relatedInvoices.length} related invoices, ${relatedJournalEntries.length} journal entries, ${unpaidCustomerTransactions.length} unpaid customer transactions, and ${unpaidVendorTransactions.length} unpaid vendor transactions were also deleted. ${customerBalancesRecalculated} customer balances and ${vendorBalancesRecalculated} vendor balances were recalculated. ${customerRefundsProcessed} customer refunds and ${vendorAdjustmentsProcessed} vendor adjustments were processed for paid invoices.`,
      deletedInvoices: relatedInvoices.length,
      deletedJournalEntries: relatedJournalEntries.length,
      deletedCustomerTransactions: unpaidCustomerTransactions.length,
      deletedVendorTransactions: unpaidVendorTransactions.length,
      balanceRecalculations: {
        customers: customerBalancesRecalculated,
        vendors: vendorBalancesRecalculated,
      },
      refundsProcessed: {
        customers: customerRefundsProcessed,
        vendors: vendorAdjustmentsProcessed,
      },
      financialAdjustments: relatedInvoices.filter(
        (inv) => inv.status === "Paid"
      ).length,
      financialSummary: {
        customerRefundsProcessed,
        vendorAdjustmentsProcessed,
        totalRefundAmount,
        totalAdjustmentAmount,
      },
    });
  } catch (error) {
    console.error("💥 ERROR during shipment deletion:", error);
    console.error("💥 Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
