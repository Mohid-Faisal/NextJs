import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const invID = searchParams.get('invID');
    const shipmentId = id;
    
    console.log('API called with:', { shipmentId, invID });
    
    if (!invID) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Fetch invoice data for editing
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: parseInt(invID),
        shipmentId: parseInt(shipmentId)
      },
      include: {
        shipment: true,
        customer: true,
        vendor: true
      }
    });

    if (!invoice) {
      console.log('No invoice found for:', { shipmentId, invID });
      return NextResponse.json({ 
        error: 'Invoice not found', 
        details: { shipmentId, invID } 
      }, { status: 404 });
    }

    console.log('Invoice found for editing:', { id: invoice.id, invoiceNumber: invoice.invoiceNumber });

    // Return invoice with discount (use shipment discount as fallback for backward compatibility)
    const invoiceWithDiscount = {
      ...invoice,
      discount: (invoice as any).discount !== undefined 
        ? (invoice as any).discount 
        : (invoice.shipment?.discount || 0)
    };

    return NextResponse.json(invoiceWithDiscount);

  } catch (error) {
    console.error("Error fetching invoice for edit:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const invID = searchParams.get('invID');
    const body = await request.json();
    
    if (!invID) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const invoiceId = parseInt(invID);
    const shipmentId = parseInt(id);
    
    console.log('Updating invoice:', { invoiceId, shipmentId, body });

    // Get current invoice to check old amount
    const currentInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        vendor: true,
        shipment: true
      }
    });

    if (!currentInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const oldAmount = currentInvoice.totalAmount;
    const newAmount = parseFloat(body.totalAmount) || 0;
    const amountChanged = oldAmount !== newAmount;

    // Import utility functions
    const { updateInvoiceBalance, updateJournalEntriesForInvoice } = await import('@/lib/utils');

    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNumber: body.invoiceNumber || currentInvoice.invoiceNumber,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : currentInvoice.invoiceDate,
        totalAmount: newAmount,
        fscCharges: parseFloat(body.fscCharges) || 0,
        discount: parseFloat(body.discount) || 0,
        dayWeek: body.shipment?.dayWeek !== undefined 
          ? (body.shipment.dayWeek === true || body.shipment.dayWeek === 'D' ? 'D' : 'W')
          : currentInvoice.dayWeek,
        lineItems: body.lineItems || currentInvoice.lineItems,
        disclaimer: body.disclaimer || currentInvoice.disclaimer,
      }
    });

    // Update shipment if it exists
    if (body.shipment && currentInvoice.shipment) {
      const shipmentUpdateData: any = {
        trackingId: body.shipment.trackingId || currentInvoice.shipment.trackingId,
        destination: body.shipment.destination || currentInvoice.shipment.destination,
        ...(body.referenceNumber !== undefined && { referenceNumber: body.referenceNumber }),
        discount: parseFloat(body.discount) || 0,
        ...(body.shipment.packages !== undefined && { packages: body.shipment.packages }),
        ...(body.shipment.calculatedValues !== undefined && { calculatedValues: body.shipment.calculatedValues }),
      };

      // Update shipment totalCost and price if amount changed
      if (amountChanged) {
        shipmentUpdateData.totalCost = newAmount;
        shipmentUpdateData.price = newAmount; // Update price as well
      }

      await prisma.shipment.update({
        where: { id: shipmentId },
        data: shipmentUpdateData
      });
    }

    // Update customer/vendor balances and transactions if amount changed
    if (amountChanged) {
      try {
        await updateInvoiceBalance(
          prisma,
          invoiceId,
          oldAmount,
          newAmount,
          currentInvoice.customerId,
          currentInvoice.customerId,
          currentInvoice.vendorId,
          currentInvoice.vendorId
        );

        // Update journal entries
        const description = `Updated invoice: ${updatedInvoice.invoiceNumber} - ${body.shipment?.destination || currentInvoice.destination || 'N/A'}`;
        await updateJournalEntriesForInvoice(
          prisma,
          invoiceId,
          oldAmount,
          newAmount,
          currentInvoice.customerId,
          currentInvoice.customerId,
          currentInvoice.vendorId,
          currentInvoice.vendorId,
          updatedInvoice.invoiceNumber,
          description
        );
      } catch (balanceError) {
        console.error("Error updating balances and journal entries:", balanceError);
        // Continue even if balance update fails
      }
    }

    console.log('Invoice updated successfully:', updatedInvoice.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Invoice updated successfully',
      invoice: updatedInvoice 
    });

  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
