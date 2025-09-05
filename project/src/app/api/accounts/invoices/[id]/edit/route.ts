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

    return NextResponse.json(invoice);

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
    const body = await request.json();
    
    console.log('Updating invoice:', { id, body });

    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: parseInt(id) },
      data: {
        invoiceNumber: body.invoiceNumber,
        totalAmount: body.totalAmount,
        fscCharges: body.fscCharges,
        dayWeek: body.shipment?.dayWeek ? 'D' : 'W',
        lineItems: body.lineItems || [],
      }
    });

    // Update shipment if it exists
    if (body.shipment) {
      await prisma.shipment.update({
        where: { id: body.shipment.id },
        data: {
          trackingId: body.shipment.trackingId,
          destination: body.shipment.destination,
          referenceNumber: body.referenceNumber,
          discount: body.discount,
          packages: body.shipment.packages,
          calculatedValues: body.shipment.calculatedValues,
        }
      });
    }

    // Update customer if it exists
    if (body.customer) {
      await prisma.customers.update({
        where: { id: body.customer.id },
        data: {
          CompanyName: body.customer.CompanyName,
          PersonName: body.customer.PersonName,
          Address: body.customer.Address,
          City: body.customer.City,
          Country: body.customer.Country,
        }
      });
    }

    // Update vendor if it exists
    if (body.vendor) {
      await prisma.vendors.update({
        where: { id: body.vendor.id },
        data: {
          CompanyName: body.vendor.CompanyName,
          PersonName: body.vendor.PersonName,
          Address: body.vendor.Address,
          City: body.vendor.City,
          Country: body.vendor.Country,
        }
      });
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
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}
