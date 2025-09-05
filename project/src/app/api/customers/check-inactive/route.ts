import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    console.log("🔄 Starting inactive customer check...");
    
    // Calculate date one year ago from today
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    console.log("📅 Checking for customers who became customers before:", oneYearAgo.toISOString());
    
    // First, get all active customers who have been customers for over a year
    const activeCustomers = await prisma.customers.findMany({
      where: {
        ActiveStatus: "Active",
        // Customer must have been created over a year ago
        createdAt: {
          lt: oneYearAgo
        }
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
          }
        }
      }
    });
    
    console.log(`📊 Found ${activeCustomers.length} customers who have been customers for over a year`);
    
    // Now check each customer individually to see if they have shipments in the past year from their customer date
    const inactiveCustomers = [];
    
    for (const customer of activeCustomers) {
      // Calculate one year from when this customer became a customer
      const customerOneYearAgo = new Date(customer.createdAt);
      customerOneYearAgo.setFullYear(customerOneYearAgo.getFullYear() + 1);
      
      // Check if this customer has any shipments in the past year from their customer date
      const hasRecentShipments = customer.invoices.some(invoice => 
        invoice.shipment && 
        invoice.shipment.shipmentDate >= customerOneYearAgo
      );
      
      if (!hasRecentShipments) {
        inactiveCustomers.push(customer);
      }
    }
    
    console.log(`📊 Found ${inactiveCustomers.length} customers to mark as inactive`);
    
    if (inactiveCustomers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No inactive customers found",
        customersMarkedInactive: 0
      });
    }
    
    // Update customer status to inactive
    const customerIds = inactiveCustomers.map(customer => customer.id);
    
    const updateResult = await prisma.customers.updateMany({
      where: {
        id: {
          in: customerIds
        }
      },
      data: {
        ActiveStatus: "Inactive"
      }
    });
    
    console.log(`✅ Updated ${updateResult.count} customers to inactive status`);
    
    // Prepare customer details for response
    const customerDetails = inactiveCustomers.map(customer => {
      const lastShipmentDate = customer.invoices[0]?.shipment?.shipmentDate;
      return {
        companyName: customer.CompanyName,
        personName: customer.PersonName,
        email: customer.Email,
        lastShipmentDate: lastShipmentDate ? lastShipmentDate.toISOString().split('T')[0] : 'No shipments found',
        customerSince: customer.createdAt.toISOString().split('T')[0]
      };
    });
    
    return NextResponse.json({
      success: true,
      message: `${updateResult.count} customers have been marked as inactive`,
      customersMarkedInactive: updateResult.count,
      customers: customerDetails
    });
    
  } catch (error) {
    console.error("❌ Error checking inactive customers:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to check inactive customers",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}


// GET endpoint to check inactive customers without updating them (for testing)
export async function GET() {
  try {
    console.log("🔍 Checking for potentially inactive customers...");
    
    // Calculate date one year ago from today
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // First, get all active customers who have been customers for over a year
    const activeCustomers = await prisma.customers.findMany({
      where: {
        ActiveStatus: "Active",
        // Customer must have been created over a year ago
        createdAt: {
          lt: oneYearAgo
        }
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
          }
        }
      }
    });
    
    console.log(`📊 Found ${activeCustomers.length} customers who have been customers for over a year`);
    
    // Now check each customer individually to see if they have shipments in the past year from their customer date
    const potentiallyInactiveCustomers = [];
    
    for (const customer of activeCustomers) {
      // Calculate one year from when this customer became a customer
      const customerOneYearAgo = new Date(customer.createdAt);
      customerOneYearAgo.setFullYear(customerOneYearAgo.getFullYear() + 1);
      
      // Check if this customer has any shipments in the past year from their customer date
      const hasRecentShipments = customer.invoices.some(invoice => 
        invoice.shipment && 
        invoice.shipment.shipmentDate >= customerOneYearAgo
      );
      
      if (!hasRecentShipments) {
        potentiallyInactiveCustomers.push(customer);
      }
    }
    
    const customerDetails = potentiallyInactiveCustomers.map(customer => {
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
      message: `Found ${potentiallyInactiveCustomers.length} customers that would be marked as inactive`,
      count: potentiallyInactiveCustomers.length,
      customers: customerDetails
    });
    
  } catch (error) {
    console.error("❌ Error checking potentially inactive customers:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to check potentially inactive customers",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
