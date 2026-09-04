import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { updateInvoiceBalance, updateJournalEntriesForInvoice } from "@/lib/server/ledger";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgInvoice } from "@/lib/tenant/findOrgInvoice";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, "view_revenue");
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const invoiceId = parseInt(id);

    const invoice: any = await findOrgInvoice(session, invoiceId, {}, {
      customer: true,
      vendor: true,
      shipment: true,
    });

    if (!invoice) {
      return NextResponse.json(
        { 
          success: false,
          message: "Invoice not found",
          error: "Invoice not found" 
        },
        { status: 404 }
      );
    }

    // Look up recipient using multiple strategies because shipment.recipientName
    // can be either a company name OR a person name depending on how the
    // shipment was created.
    let recipient = null;
    if (invoice.shipment?.recipientName) {
      const name = String(invoice.shipment.recipientName).trim();
      if (name) {
        recipient =
          (await prisma.recipients.findFirst({
            where: orgWhere(session, { CompanyName: { equals: name} }),
          })) ||
          (await prisma.recipients.findFirst({
            where: orgWhere(session, { PersonName: { equals: name} }),
          })) ||
          (await prisma.recipients.findFirst({
            where: orgWhere(session, {
              OR: [
                { CompanyName: { contains: name} },
                { PersonName: { contains: name} },
              ],
            }),
          }));
      }
    }

    return NextResponse.json({ invoice: { ...invoice, recipient } });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: invoice edits are accounting operations gated behind the
    // billing management permission (also enforces plan restrictions).
    const auth = await requirePermission(req, "manage_billing");
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const invoiceId = parseInt(id);
    const body = await req.json();

    const currentInvoice = await prisma.invoice.findFirst({
      where: orgWhere(session, { id: invoiceId }),
      select: {
        totalAmount: true,
        customerId: true,
        vendorId: true,
        shipmentId: true,
        profile: true,
        invoiceDate: true,
        invoiceNumber: true,
        destination: true,
      },
    });

    if (!currentInvoice) {
      return NextResponse.json(
        { 
          success: false,
          message: "Invoice not found",
          error: "Invoice not found" 
        },
        { status: 404 }
      );
    }

    const oldAmount = currentInvoice.totalAmount;
    const newAmount = body.totalAmount !== undefined ? parseFloat(body.totalAmount) : oldAmount;
    const oldCustomerId = currentInvoice.customerId;
    const newCustomerId = body.customerId !== undefined ? (body.customerId ? parseInt(body.customerId) : null) : oldCustomerId;
    const oldVendorId = currentInvoice.vendorId;
    const newVendorId = body.vendorId !== undefined ? (body.vendorId ? parseInt(body.vendorId) : null) : oldVendorId;

    // SECURITY: validate related-entity IDs belong to the caller's
    // organization. Previously client-supplied customerId/vendorId/shipmentId
    // were trusted, allowing cross-tenant linking and cross-tenant writes to
    // customer balances and shipment records downstream.
    if (body.customerId !== undefined && body.customerId !== null && body.customerId !== "") {
      const custId = parseInt(body.customerId);
      const owned = await prisma.customers.findFirst({
        where: orgWhere(session, { id: custId }),
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { success: false, message: "Customer not found in your organization" },
          { status: 400 }
        );
      }
    }
    if (body.vendorId !== undefined && body.vendorId !== null && body.vendorId !== "") {
      const vendId = parseInt(body.vendorId);
      const ownedVendor = await prisma.vendors.findFirst({
        where: orgWhere(session, { id: vendId }),
        select: { id: true },
      });
      if (!ownedVendor) {
        return NextResponse.json(
          { success: false, message: "Vendor not found in your organization" },
          { status: 400 }
        );
      }
    }
    if (body.shipmentId !== undefined && body.shipmentId !== null && body.shipmentId !== "") {
      const shipId = parseInt(body.shipmentId);
      const ownedShipment = await prisma.shipment.findFirst({
        where: orgWhere(session, { id: shipId }),
        select: { id: true },
      });
      if (!ownedShipment) {
        return NextResponse.json(
          { success: false, message: "Shipment not found in your organization" },
          { status: 400 }
        );
      }
    }

    // Build update data object with only provided fields
    const updateData: any = {};
    
    if (body.invoiceNumber !== undefined) updateData.invoiceNumber = body.invoiceNumber;
    if (body.invoiceDate !== undefined) updateData.invoiceDate = new Date(body.invoiceDate);
    if (body.receiptNumber !== undefined) updateData.receiptNumber = body.receiptNumber;
    if (body.trackingNumber !== undefined) updateData.trackingNumber = body.trackingNumber;
    if (body.destination !== undefined) updateData.destination = body.destination;
    if (body.dayWeek !== undefined) updateData.dayWeek = body.dayWeek;
    if (body.weight !== undefined) updateData.weight = parseFloat(body.weight);
    if (body.profile !== undefined) updateData.profile = body.profile;
    if (body.fscCharges !== undefined) updateData.fscCharges = parseFloat(body.fscCharges || 0);
    if (body.lineItems !== undefined) updateData.lineItems = body.lineItems;
    if (body.customerId !== undefined) updateData.customerId = body.customerId ? parseInt(body.customerId) : null;
    if (body.vendorId !== undefined) updateData.vendorId = body.vendorId ? parseInt(body.vendorId) : null;
    if (body.shipmentId !== undefined) updateData.shipmentId = body.shipmentId ? parseInt(body.shipmentId) : null;
    if (body.disclaimer !== undefined) updateData.disclaimer = body.disclaimer;
    if (body.totalAmount !== undefined) updateData.totalAmount = newAmount;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.status !== undefined) updateData.status = body.status;

    const result = await prisma.$transaction(async (tx) => {
      // Update the invoice
      const invoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: updateData,
        include: {
          customer: true,
          vendor: true,
          shipment: true,
        },
      });

      // Update balances if totalAmount, customerId, or vendorId changed
      const amountChanged = oldAmount !== newAmount;
      const customerChanged = oldCustomerId !== newCustomerId;
      const vendorChanged = oldVendorId !== newVendorId;
      const balanceChanged = amountChanged || customerChanged || vendorChanged;
      let balanceUpdateResult = { customerUpdated: false, vendorUpdated: false };
      if (balanceChanged) {
        balanceUpdateResult = await updateInvoiceBalance(
          tx, 
          invoiceId, 
          oldAmount, 
          newAmount,
          oldCustomerId,
          newCustomerId,
          oldVendorId,
          newVendorId
        );
      }

      // Update journal entries if totalAmount, customerId, vendorId, date, or invoiceNumber changed
      const dateChanged = Boolean(
        updateData.invoiceDate &&
        currentInvoice.invoiceDate &&
        updateData.invoiceDate.getTime() !== new Date(currentInvoice.invoiceDate).getTime()
      );
      const numberChanged = Boolean(
        updateData.invoiceNumber &&
        updateData.invoiceNumber !== currentInvoice.invoiceNumber
      );
      const journalNeedsUpdate = balanceChanged || dateChanged || numberChanged;

      let journalUpdateResult = { customerUpdated: false, vendorUpdated: false };
      if (journalNeedsUpdate) {
        const description = `Updated invoice: ${body.invoiceNumber || invoice.invoiceNumber} - ${body.destination || invoice.destination || 'N/A'}`;
        journalUpdateResult = await updateJournalEntriesForInvoice(
          tx,
          invoiceId,
          oldAmount,
          newAmount,
          oldCustomerId,
          newCustomerId,
          oldVendorId,
          newVendorId,
          body.invoiceNumber || invoice.invoiceNumber,
          description,
          session.organizationId,
          updateData.invoiceDate
        );
      }

      // Update linked shipment pricing when totalAmount changes
      let shipmentUpdateResult: { updated: boolean; error: string | null } = { updated: false, error: null };
      const targetShipmentId = invoice.shipmentId || currentInvoice.shipmentId;
      if (amountChanged && targetShipmentId) {
        // Defense-in-depth: never touch another tenant's shipment.
        const ownedShipment = await tx.shipment.findFirst({
          where: orgWhere(session, { id: targetShipmentId }),
          select: { id: true, calculatedValues: true },
        });
        if (!ownedShipment) {
          shipmentUpdateResult.error = "Linked shipment does not belong to your organization";
        } else {
          const isVendor = invoice.profile === "Vendor" || Boolean(invoice.vendorId || currentInvoice.vendorId);
          if (isVendor) {
            let updatedCalculatedValues: any = undefined;
            if (ownedShipment.calculatedValues) {
              try {
                const rawCalc: any = ownedShipment.calculatedValues;
                const calc = typeof rawCalc === 'string'
                  ? JSON.parse(rawCalc)
                  : { ...rawCalc };
                calc.cos = newAmount;
                calc.vendorPrice = newAmount;
                updatedCalculatedValues = calc;
              } catch (e) {
                console.error("Error parsing shipment calculatedValues:", e);
              }
            }
            await tx.shipment.update({
              where: { id: targetShipmentId },
              data: {
                cos: newAmount,
                ...(updatedCalculatedValues ? { calculatedValues: updatedCalculatedValues } : {})
              }
            });
            shipmentUpdateResult.updated = true;
          } else {
            await tx.shipment.update({
              where: { id: targetShipmentId },
              data: { totalCost: newAmount }
            });
            shipmentUpdateResult.updated = true;
          }
        }
      }

      return {
        invoice,
        balanceChanged,
        balanceUpdateResult,
        journalNeedsUpdate,
        journalUpdateResult,
        shipmentUpdated: amountChanged && Boolean(targetShipmentId),
        shipmentUpdateResult,
      };
    }, { timeout: 30000 });

    return NextResponse.json({ 
      success: true,
      message: "Invoice updated successfully",
      invoice: result.invoice,
      balanceUpdated: result.balanceChanged,
      balanceUpdateResult: result.balanceUpdateResult,
      journalUpdated: result.journalNeedsUpdate,
      journalUpdateResult: result.journalUpdateResult,
      shipmentUpdated: result.shipmentUpdated,
      shipmentUpdateResult: result.shipmentUpdateResult
    });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { 
        success: false,
        message: error instanceof Error ? error.message : "Failed to update invoice",
        error: "Failed to update invoice" 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, "manage_billing");
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const invoiceId = parseInt(id);

    const existing = await findOrgInvoice(session, invoiceId);
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invNum = existing.invoiceNumber;
    const invAmount = existing.totalAmount || 0;

    await prisma.$transaction(async (tx) => {
      // 1. Delete matching journal entries (lines first)
      if (invNum) {
        const jes = await tx.journalEntry.findMany({
          where: orgWhere(session, {
            reference: invNum,
          }),
          select: { id: true },
        });
        if (jes.length > 0) {
          const jeIds = jes.map((j) => j.id);
          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: { in: jeIds } },
          });
          await tx.journalEntry.deleteMany({
            where: { id: { in: jeIds } },
          });
        }
      }

      // 2. Delete customer ledger transactions and restore customer balance
      if (existing.customerId && invNum) {
        const customerTxns = await tx.customerTransaction.findMany({
          where: orgWhere(session, {
            customerId: existing.customerId,
            OR: [{ reference: invNum }, { invoice: invNum }],
          }),
        });
        if (customerTxns.length > 0) {
          await tx.customerTransaction.deleteMany({
            where: { id: { in: customerTxns.map((t) => t.id) } },
          });
          // Restore customer balance (debit had decreased/made negative their balance)
          const cust = await tx.customers.findFirst({
            where: orgWhere(session, { id: existing.customerId }),
          });
          if (cust) {
            await tx.customers.update({
              where: { id: cust.id },
              data: { currentBalance: cust.currentBalance + invAmount },
            });
          }
        }
      }

      // 3. Delete vendor ledger transactions and restore vendor balance
      if (existing.vendorId && invNum) {
        const vendorTxns = await tx.vendorTransaction.findMany({
          where: orgWhere(session, {
            vendorId: existing.vendorId,
            OR: [{ reference: invNum }, { invoice: invNum }],
          }),
        });
        if (vendorTxns.length > 0) {
          await tx.vendorTransaction.deleteMany({
            where: { id: { in: vendorTxns.map((t) => t.id) } },
          });
          // Restore vendor balance (debit had increased vendor payable)
          const ven = await tx.vendors.findFirst({
            where: orgWhere(session, { id: existing.vendorId }),
          });
          if (ven) {
            await tx.vendors.update({
              where: { id: ven.id },
              data: { currentBalance: ven.currentBalance - invAmount },
            });
          }
        }
      }

      // 4. Delete the invoice
      await tx.invoice.delete({
        where: { id: invoiceId },
      });
    });

    return NextResponse.json({ message: "Invoice deleted successfully" });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
