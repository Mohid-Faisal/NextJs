import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";

/**
 * SECURITY: previously unauthenticated and operating across ALL tenants
 * (global scan + global write + PII in responses). Now requires the
 * manage_customers / view_customers permission and is scoped to the
 * caller's organization.
 */

async function findInactiveForOrg(organizationId: number) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const activeCustomers = await prisma.customers.findMany({
    where: {
      organizationId,
      ActiveStatus: "Active",
      createdAt: { lt: oneYearAgo }
    },
    select: {
      id: true,
      CompanyName: true,
      PersonName: true,
      Email: true,
      createdAt: true,
      invoices: {
        select: {
          shipment: { select: { shipmentDate: true, trackingId: true } }
        },
        orderBy: { shipment: { shipmentDate: 'desc' } }
      }
    }
  });

  const inactiveCustomers = [];
  for (const customer of activeCustomers) {
    const customerOneYearAgo = new Date(customer.createdAt);
    customerOneYearAgo.setFullYear(customerOneYearAgo.getFullYear() + 1);
    const hasRecentShipments = customer.invoices.some(invoice =>
      invoice.shipment &&
      invoice.shipment.shipmentDate >= customerOneYearAgo
    );
    if (!hasRecentShipments) {
      inactiveCustomers.push(customer);
    }
  }

  return inactiveCustomers;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_customers");
    if (auth.error) return auth.error;
    const session = auth.session;

    const inactiveCustomers = await findInactiveForOrg(session.organizationId);

    if (inactiveCustomers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No inactive customers found",
        customersMarkedInactive: 0
      });
    }

    const customerIds = inactiveCustomers.map(customer => customer.id);

    const updateResult = await prisma.customers.updateMany({
      where: orgWhere(session, { id: { in: customerIds } }),
      data: { ActiveStatus: "Inactive" }
    });

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
    console.error("Error checking inactive customers:", error);
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

// GET — dry-run check without updating (scoped to caller's organization)
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "view_customers");
    if (auth.error) return auth.error;
    const session = auth.session;

    const potentiallyInactiveCustomers = await findInactiveForOrg(session.organizationId);

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
    console.error("Error checking potentially inactive customers:", error);
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
