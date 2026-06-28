import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { updateInvoiceBalance, updateJournalEntriesForInvoice } from "@/lib/utils";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgInvoice } from "@/lib/tenant/findOrgInvoice";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const invoiceId = parseInt(id);

    const invoice = await findOrgInvoice(session, invoiceId, {}, {
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
            where: orgWhere(session, { CompanyName: { equals: name, mode: "insensitive" } }),
          })) ||
          (await prisma.recipients.findFirst({
            where: orgWhere(session, { PersonName: { equals: name, mode: "insensitive" } }),
          })) ||
          (await prisma.recipients.findFirst({
            where: orgWhere(session, {
              OR: [
                { CompanyName: { contains: name, mode: "insensitive" } },
                { PersonName: { contains: name, mode: "insensitive" } },
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
    const auth = await requireApiSession(req);
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

    // Update the invoice
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        customer: true,
        vendor: true,
        shipment: true,
      },
    });

    // Update balances if totalAmount, customerId, or vendorId changed
    let balanceUpdateResult = { customerUpdated: false, vendorUpdated: false };
    if (oldAmount !== newAmount || oldCustomerId !== newCustomerId || oldVendorId !== newVendorId) {
      try {
        balanceUpdateResult = await updateInvoiceBalance(
          prisma, 
          invoiceId, 
          oldAmount, 
          newAmount,
          oldCustomerId,
          newCustomerId,
          oldVendorId,
          newVendorId
        );
      } catch (balanceError) {
        console.error("Error updating balances:", balanceError);
        // Continue with the response even if balance update fails
      }
    }

    // Update journal entries if totalAmount, customerId, or vendorId changed
    let journalUpdateResult = { customerUpdated: false, vendorUpdated: false };
    if (oldAmount !== newAmount || oldCustomerId !== newCustomerId || oldVendorId !== newVendorId) {
      try {
        const description = `Updated invoice: ${body.invoiceNumber || invoice.invoiceNumber} - ${body.destination || invoice.destination || 'N/A'}`;
        journalUpdateResult = await updateJournalEntriesForInvoice(
          prisma,
          invoiceId,
          oldAmount,
          newAmount,
          oldCustomerId,
          newCustomerId,
          oldVendorId,
          newVendorId,
          body.invoiceNumber || invoice.invoiceNumber,
          description,
          session.organizationId
        );
      } catch (journalError) {
        console.error("Error updating journal entries:", journalError);
        // Continue with the response even if journal entry update fails
      }
    }

    // Update shipment totalCost if this is a customer invoice and totalAmount changed
    let shipmentUpdateResult: { updated: boolean; error: string | null } = { updated: false, error: null };
    if (invoice.profile === "Customer" && oldAmount !== newAmount && invoice.shipmentId) {
      try {
        await prisma.shipment.update({
          where: { id: invoice.shipmentId },
          data: { totalCost: newAmount }
        });
        shipmentUpdateResult.updated = true;
        console.log(`Updated shipment ${invoice.shipmentId} totalCost from ${oldAmount} to ${newAmount}`);
      } catch (shipmentError) {
        console.error("Error updating shipment totalCost:", shipmentError);
        shipmentUpdateResult.error = shipmentError instanceof Error ? shipmentError.message : "Unknown error";
        // Continue with the response even if shipment update fails
      }
    }

    return NextResponse.json({ 
      success: true,
      message: "Invoice updated successfully",
      invoice,
      balanceUpdated: oldAmount !== newAmount || oldCustomerId !== newCustomerId || oldVendorId !== newVendorId,
      balanceUpdateResult,
      journalUpdated: oldAmount !== newAmount || oldCustomerId !== newCustomerId || oldVendorId !== newVendorId,
      journalUpdateResult,
      shipmentUpdated: invoice.profile === "Customer" && oldAmount !== newAmount && invoice.shipmentId,
      shipmentUpdateResult
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
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const invoiceId = parseInt(id);

    const existing = await findOrgInvoice(session, invoiceId);
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await prisma.invoice.delete({
      where: { id: invoiceId },
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
