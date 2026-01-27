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

    const searchTrimmed = search.trim();
    if (searchTrimmed) {
      where.OR = [
        { invoiceNumber: { contains: searchTrimmed, mode: "insensitive" } },
        { customer: { PersonName: { contains: searchTrimmed, mode: "insensitive" } } },
        { customer: { CompanyName: { contains: searchTrimmed, mode: "insensitive" } } },
      ];
    } else {
      // Only fetch when search is provided – search across all invoices by invoice no
      return NextResponse.json({ invoices: [] });
    }

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
      take: 100,
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
