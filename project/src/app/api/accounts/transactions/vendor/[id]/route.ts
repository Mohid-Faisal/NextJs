import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addVendorTransaction } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = parseInt(params.id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    // Get vendor with transactions
    const vendor = await prisma.vendors.findUnique({
      where: { id: vendorId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50 // Limit to last 50 transactions
        }
      }
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      vendor: {
        id: vendor.id,
        CompanyName: vendor.CompanyName,
        PersonName: vendor.PersonName,
        currentBalance: vendor.currentBalance,
        creditLimit: vendor.creditLimit
      },
      transactions: vendor.transactions
    });

  } catch (error) {
    console.error("Error fetching vendor transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor transactions" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = parseInt(params.id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { type, amount, description, reference } = body;

    if (!type || !amount || !description) {
      return NextResponse.json(
        { error: "Type, amount, and description are required" },
        { status: 400 }
      );
    }

    if (!['CREDIT', 'DEBIT'].includes(type)) {
      return NextResponse.json(
        { error: "Type must be CREDIT or DEBIT" },
        { status: 400 }
      );
    }

    const result = await addVendorTransaction(
      prisma,
      vendorId,
      type,
      parseFloat(amount),
      description,
      reference
    );

    return NextResponse.json({
      success: true,
      message: "Transaction added successfully",
      previousBalance: result.previousBalance,
      newBalance: result.newBalance
    });

  } catch (error) {
    console.error("Error adding vendor transaction:", error);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}
