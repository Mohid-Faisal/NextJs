import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/credit-notes/invoices - Get available customer invoices for credit note creation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || "";
    const search = searchParams.get("search") || "";

    // Build where clause
    const where: any = {
      profile: "Customer", // Only customer invoices
      // Removed status filter to show all customer invoices
    };

    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customer: { PersonName: { contains: search, mode: "insensitive" } } },
        { customer: { CompanyName: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Get invoices with customer information
    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
        currency: true,
        customer: {
          select: {
            id: true,
            PersonName: true,
            CompanyName: true,
          },
        },
      },
      orderBy: { invoiceDate: "desc" },
      take: 50, // Limit to 50 results
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
