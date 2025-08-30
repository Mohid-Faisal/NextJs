import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { updateInvoiceBalance } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoiceId = parseInt(id);

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        vendor: true,
        shipment: true,
      },
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

    return NextResponse.json({ invoice });
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
    const { id } = await params;
    const invoiceId = parseInt(id);
    const body = await req.json();

    // Get the current invoice to check if totalAmount, customerId, or vendorId is being changed
    const currentInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { 
        totalAmount: true,
        customerId: true,
        vendorId: true
      }
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

    return NextResponse.json({ 
      success: true,
      message: "Invoice updated successfully",
      invoice,
      balanceUpdated: oldAmount !== newAmount || oldCustomerId !== newCustomerId || oldVendorId !== newVendorId,
      balanceUpdateResult
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
    const { id } = await params;
    const invoiceId = parseInt(id);

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
