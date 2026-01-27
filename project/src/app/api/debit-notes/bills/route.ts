import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/debit-notes/bills - Get available bills for debit note creation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendorId") || "";
    const search = searchParams.get("search") || "";

    // Build where clause
    const where: any = {
      profile: "Vendor", // Only vendor invoices
      // Removed status filter to show all vendor invoices
    };

    if (vendorId) {
      where.vendorId = parseInt(vendorId);
    }

    const searchTrimmed = search.trim();
    if (searchTrimmed) {
      where.OR = [
        { invoiceNumber: { contains: searchTrimmed, mode: "insensitive" } },
        { vendor: { PersonName: { contains: searchTrimmed, mode: "insensitive" } } },
        { vendor: { CompanyName: { contains: searchTrimmed, mode: "insensitive" } } },
      ];
    } else {
      // Only fetch when search is provided – search across all bills by invoice no
      return NextResponse.json({ bills: [] });
    }

    const bills = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
        currency: true,
        vendor: {
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

    return NextResponse.json({ bills });
  } catch (error) {
    console.error("Error fetching bills:", error);
    return NextResponse.json(
      { error: "Failed to fetch bills" },
      { status: 500 }
    );
  }
}
