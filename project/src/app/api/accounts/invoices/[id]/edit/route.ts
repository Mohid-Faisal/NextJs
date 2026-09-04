import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgInvoice } from "@/lib/tenant/findOrgInvoice";
import { updateInvoiceBalance, updateJournalEntriesForInvoice } from "@/lib/server/ledger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "view_revenue");
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const invID = searchParams.get('invID');
    const shipmentId = id;
    
    console.log('API called with:', { shipmentId, invID });
    
    if (!invID) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Fetch invoice data for editing
    const invoice: any = await findOrgInvoice(
      session,
      parseInt(invID),
      { shipmentId: parseInt(shipmentId) },
      { shipment: true, customer: true, vendor: true }
    );

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
    const auth = await requirePermission(request, "manage_billing");
    if (auth.error) return auth.error;
    const session = auth.session;

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
    const currentInvoice: any = await findOrgInvoice(session, invoiceId, {}, {
      customer: true,
      vendor: true,
      shipment: true,
    });

    if (!currentInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const oldAmount = currentInvoice.totalAmount;
    const newAmount = parseFloat(body.totalAmount) || 0;
    const amountChanged = oldAmount !== newAmount;

    const newInvoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : currentInvoice.invoiceDate;
    const dateChanged = Boolean(
      body.invoiceDate &&
      currentInvoice.invoiceDate &&
      new Date(body.invoiceDate).getTime() !== new Date(currentInvoice.invoiceDate).getTime()
    );
    const invoiceNumberChanged = Boolean(body.invoiceNumber && body.invoiceNumber !== currentInvoice.invoiceNumber);
    const journalNeedsUpdate = amountChanged || dateChanged || invoiceNumberChanged;

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // Update invoice
      const invoice = await tx.invoice.update({
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

      // Update shipment if linked
      const targetShipmentId = shipmentId || currentInvoice.shipmentId || currentInvoice.shipment?.id;
      if (targetShipmentId) {
        const isVendor = Boolean(
          currentInvoice.vendorId || 
          currentInvoice.vendor || 
          currentInvoice.profile?.toLowerCase() === 'vendor'
        );

        const shipmentUpdateData: any = {};

        if (body.shipment) {
          if (body.shipment.trackingId) shipmentUpdateData.trackingId = body.shipment.trackingId;
          if (body.shipment.destination) shipmentUpdateData.destination = body.shipment.destination;
          if (body.referenceNumber !== undefined) shipmentUpdateData.referenceNumber = body.referenceNumber;
          if (body.discount !== undefined || body.shipment.discount !== undefined) {
            shipmentUpdateData.discount = parseFloat(body.discount ?? body.shipment.discount) || 0;
          }
          if (body.fscCharges !== undefined || body.shipment.fuelSurcharge !== undefined) {
            shipmentUpdateData.fuelSurcharge = parseFloat(body.fscCharges ?? body.shipment.fuelSurcharge) || 0;
          }
          if (body.shipment.packages !== undefined) shipmentUpdateData.packages = body.shipment.packages;
          if (body.shipment.calculatedValues !== undefined) shipmentUpdateData.calculatedValues = body.shipment.calculatedValues;
        } else {
          if (body.discount !== undefined) shipmentUpdateData.discount = parseFloat(body.discount) || 0;
          if (body.fscCharges !== undefined) shipmentUpdateData.fuelSurcharge = parseFloat(body.fscCharges) || 0;
        }

        // Synchronize calculatedValues with FSC, discount, and totals
        const existingCalc = shipmentUpdateData.calculatedValues || currentInvoice.shipment?.calculatedValues;
        if (existingCalc) {
          try {
            const calc = typeof existingCalc === 'string' ? JSON.parse(existingCalc) : { ...existingCalc };
            if (body.fscCharges !== undefined || body.shipment?.fuelSurcharge !== undefined) {
              calc.fuelSurcharge = parseFloat(body.fscCharges ?? body.shipment?.fuelSurcharge) || 0;
            }
            if (body.discount !== undefined || body.shipment?.discount !== undefined) {
              calc.discount = parseFloat(body.discount ?? body.shipment?.discount) || 0;
            }
            if (amountChanged) {
              if (isVendor) {
                calc.cos = newAmount;
                calc.vendorPrice = newAmount;
              } else {
                calc.total = newAmount;
              }
            }
            shipmentUpdateData.calculatedValues = calc;
          } catch (e) {
            console.error("Error updating calculatedValues for invoice edit:", e);
          }
        }

        // Update pricing fields when invoice amount changes
        if (amountChanged) {
          if (isVendor) {
            // Editing a Vendor invoice updates the shipment's Cost of Service (COS)
            shipmentUpdateData.cos = newAmount;
          } else {
            // Editing a Customer invoice updates totalCost and price
            shipmentUpdateData.totalCost = newAmount;
            shipmentUpdateData.price = newAmount;
          }
        }

        if (Object.keys(shipmentUpdateData).length > 0) {
          await tx.shipment.update({
            where: { id: targetShipmentId },
            data: shipmentUpdateData
          });
          console.log(`Updated shipment ${targetShipmentId} for ${isVendor ? `vendor invoice (cos=${newAmount})` : `customer invoice (totalCost=${newAmount})`}`);
        }
      }

      // Update customer/vendor balances and transactions if amount changed
      if (amountChanged) {
        await updateInvoiceBalance(
          tx,
          invoiceId,
          oldAmount,
          newAmount,
          currentInvoice.customerId,
          currentInvoice.customerId,
          currentInvoice.vendorId,
          currentInvoice.vendorId
        );
      }

      // Update journal entries if amount changed, date changed, or invoice number changed
      if (journalNeedsUpdate) {
        const description = `Updated invoice: ${invoice.invoiceNumber} - ${body.shipment?.destination || currentInvoice.destination || 'N/A'}`;
        await updateJournalEntriesForInvoice(
          tx,
          invoiceId,
          oldAmount,
          newAmount,
          currentInvoice.customerId,
          currentInvoice.customerId,
          currentInvoice.vendorId,
          currentInvoice.vendorId,
          invoice.invoiceNumber,
          description,
          session.organizationId,
          newInvoiceDate ? new Date(newInvoiceDate) : undefined
        );
      }

      return invoice;
    }, { timeout: 30000 });

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
