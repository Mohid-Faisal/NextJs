import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createJournalEntryForTransaction } from "@/lib/server/ledger";
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
          include: { customer: true, vendor: true },
          orderBy: { id: "asc" },
          take: 10,
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
    const customerInvoice = shipment.invoices?.find((inv) => inv.profile === "Customer" || (!inv.profile && inv.customerId && !inv.vendorId));
    const vendorInvoice = shipment.invoices?.find((inv) => inv.profile === "Vendor" || (!inv.profile && inv.vendorId && !inv.customerId));
    const resolvedVendorCost =
      Number(shipment.cos) > 0
        ? Number(shipment.cos)
        : Number(vendorInvoice?.totalAmount) > 0
          ? Number(vendorInvoice?.totalAmount)
          : 0;
    const hydratedShipment = {
      ...shipment,
      cos: resolvedVendorCost,
    };
    let customer = customerInvoice?.customer ?? null;
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
      shipment: hydratedShipment,
      vendorInvoice,
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
      customerTxnOr.push({
        reference: { in: customerInvoiceNumbers.map((n) => `REFUND-${n}`) },
      });
    }
    if (trackingId) {
      customerTxnOr.push({ reference: trackingId });
      customerTxnOr.push({ description: { contains: trackingId } });
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
      vendorTxnOr.push({
        reference: { in: vendorInvoiceNumbers.map((n) => `ADJUST-${n}`) },
      });
      vendorTxnOr.push({
        reference: { in: vendorInvoiceNumbers.map((n) => `REFUND-${n}`) },
      });
    }
    if (trackingId) {
      vendorTxnOr.push({ reference: trackingId });
      vendorTxnOr.push({ description: { contains: trackingId } });
    }

    const relatedVendorTransactions = vendorTxnOr.length
      ? await prisma.vendorTransaction.findMany({
          where: orgWhere(session, { OR: vendorTxnOr }),
        })
      : [];

    let customerBalancesRecalculated = 0;
    let vendorBalancesRecalculated = 0;

    // ATOMIC CASCADE DELETION: Execute all deletions and balance recalculations
    // inside a single database transaction.
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

        // 2. Delete related customer transactions & recalculate customer balances
        if (relatedCustomerTransactions.length > 0) {
          await tx.customerTransaction.deleteMany({
            where: { id: { in: relatedCustomerTransactions.map((t) => t.id) } },
          });
        }
        const affectedCustomerIds = new Set<number>();
        for (const t of relatedCustomerTransactions) {
          if (t.customerId) affectedCustomerIds.add(t.customerId);
        }
        for (const inv of relatedInvoices) {
          if (inv.customerId) affectedCustomerIds.add(inv.customerId);
        }

        for (const customerId of affectedCustomerIds) {
          const remainingTransactions = await tx.customerTransaction.findMany({
            where: orgWhere(session, { customerId }),
            orderBy: { createdAt: "asc" },
          });
          const startingTx = remainingTransactions.find(
            (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
          );
          let newBalance = 0;
          if (startingTx) {
            newBalance =
              startingTx.type === "DEBIT"
                ? -Number(startingTx.amount || 0)
                : Number(startingTx.amount || 0);
          }
          for (const transaction of remainingTransactions) {
            if (
              transaction.reference &&
              transaction.reference.startsWith("STARTING-BALANCE")
            )
              continue;
            const amt = Number(transaction.amount || 0);
            if (transaction.type === "DEBIT") newBalance -= amt;
            else if (transaction.type === "CREDIT") newBalance += amt;
          }
          await tx.customers.update({
            where: { id: customerId },
            data: { currentBalance: newBalance },
          });
          customerBalancesRecalculated++;
        }

        // 3. Delete related vendor transactions & recalculate vendor balances
        if (relatedVendorTransactions.length > 0) {
          await tx.vendorTransaction.deleteMany({
            where: { id: { in: relatedVendorTransactions.map((t) => t.id) } },
          });
        }
        const affectedVendorIds = new Set<number>();
        for (const t of relatedVendorTransactions) {
          if (t.vendorId) affectedVendorIds.add(t.vendorId);
        }
        for (const inv of relatedInvoices) {
          if (inv.vendorId) affectedVendorIds.add(inv.vendorId);
        }
        for (const vendorId of affectedVendorIds) {
          const remainingTransactions = await tx.vendorTransaction.findMany({
            where: orgWhere(session, { vendorId }),
            orderBy: { createdAt: "asc" },
          });
          const startingTx = remainingTransactions.find(
            (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
          );
          let newBalance = 0;
          if (startingTx) {
            newBalance =
              startingTx.type === "DEBIT"
                ? Number(startingTx.amount || 0)
                : -Number(startingTx.amount || 0);
          }
          for (const transaction of remainingTransactions) {
            if (
              transaction.reference &&
              transaction.reference.startsWith("STARTING-BALANCE")
            )
              continue;
            const amt = Number(transaction.amount || 0);
            if (transaction.type === "DEBIT") newBalance += amt;
            else if (transaction.type === "CREDIT") newBalance += amt;
          }
          await tx.vendors.update({
            where: { id: vendorId },
            data: { currentBalance: newBalance },
          });
          vendorBalancesRecalculated++;
        }

        // 4. Delete related invoices (including payment allocations, debit notes, and credit notes)
        if (relatedInvoices.length > 0) {
          const invoiceIds = relatedInvoices.map((inv) => inv.id);
          await tx.paymentAllocation.deleteMany({
            where: { invoiceId: { in: invoiceIds } },
          });
          await tx.debitNote.deleteMany({
            where: { billId: { in: invoiceIds } },
          });
          await tx.creditNote.deleteMany({
            where: { invoiceId: { in: invoiceIds } },
          });
          await tx.invoice.deleteMany({
            where: orgWhere(session, { OR: invoiceOr }),
          });
        }

        // 5. Delete shipment
        await tx.shipment.delete({
          where: { id: shipmentId },
        });
      },
      { timeout: 30000 }
    );

    return NextResponse.json({
      success: true,
      message: `Shipment deleted successfully. ${relatedInvoices.length} related invoices, ${relatedJournalEntries.length} journal entries, ${relatedCustomerTransactions.length} customer transactions, and ${relatedVendorTransactions.length} vendor transactions were deleted. ${customerBalancesRecalculated} customer balances and ${vendorBalancesRecalculated} vendor balances were recalculated.`,
      deletedInvoices: relatedInvoices.length,
      deletedJournalEntries: relatedJournalEntries.length,
      deletedCustomerTransactions: relatedCustomerTransactions.length,
      deletedVendorTransactions: relatedVendorTransactions.length,
      balanceRecalculations: {
        customers: customerBalancesRecalculated,
        vendors: vendorBalancesRecalculated,
      },
    });
  } catch (error) {
    console.error("💥 ERROR during shipment deletion:", error);
    console.error("💥 Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete shipment" },
      { status: 500 }
    );
  }
}
