import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { customerId } = await req.json();
    
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Customer ID is required" },
        { status: 400 }
      );
    }
    
    // Check if customer exists
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, CompanyName: true, ActiveStatus: true }
    });
    
    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }
    
    if (customer.ActiveStatus === "Active") {
      return NextResponse.json(
        { success: false, message: "Customer is already active" },
        { status: 400 }
      );
    }
    
    // Update customer status to active
    const updatedCustomer = await prisma.customers.update({
      where: { id: customerId },
      data: { ActiveStatus: "Active" },
      select: {
        id: true,
        CompanyName: true,
        PersonName: true,
        Email: true,
        ActiveStatus: true
      }
    });
    
    console.log(`✅ Reactivated customer: ${updatedCustomer.CompanyName}`);
    
    return NextResponse.json({
      success: true,
      message: `Customer ${updatedCustomer.CompanyName} has been reactivated`,
      customer: updatedCustomer
    });
    
  } catch (error) {
    console.error("❌ Error reactivating customer:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to reactivate customer",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// GET endpoint to list inactive customers
export async function GET() {
  try {
    const inactiveCustomers = await prisma.customers.findMany({
      where: {
        ActiveStatus: "Inactive"
      },
      select: {
        id: true,
        CompanyName: true,
        PersonName: true,
        Email: true,
        createdAt: true,
        invoices: {
          select: {
            shipment: {
              select: {
                shipmentDate: true,
                trackingId: true
              }
            }
          },
          orderBy: {
            shipment: {
              shipmentDate: 'desc'
            }
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const customerDetails = inactiveCustomers.map(customer => {
      const lastShipmentDate = customer.invoices[0]?.shipment?.shipmentDate;
      return {
        id: customer.id,
        companyName: customer.CompanyName,
        personName: customer.PersonName,
        email: customer.Email,
        lastShipmentDate: lastShipmentDate ? lastShipmentDate.toISOString().split('T')[0] : 'No shipments found',
        customerSince: customer.createdAt.toISOString().split('T')[0]
      };
    });
    
    return NextResponse.json({
      success: true,
      message: `Found ${inactiveCustomers.length} inactive customers`,
      count: inactiveCustomers.length,
      customers: customerDetails
    });
    
  } catch (error) {
    console.error("❌ Error fetching inactive customers:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch inactive customers",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
