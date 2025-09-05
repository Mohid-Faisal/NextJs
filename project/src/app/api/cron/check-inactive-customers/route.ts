import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    console.log("🕐 Cron job: Starting inactive customer check...");
    
    // Verify this is a legitimate cron request (optional security check)
    const authHeader = process.env.CRON_SECRET;
    if (authHeader) {
      const requestAuth = process.env.CRON_SECRET;
      if (!requestAuth || requestAuth !== authHeader) {
        return NextResponse.json(
          { success: false, message: "Unauthorized" },
          { status: 401 }
        );
      }
    }
    
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
        customersMarkedInactive: 0,
        timestamp: new Date().toISOString()
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
      customers: customerDetails,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Error in cron job for inactive customers:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to check inactive customers",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

