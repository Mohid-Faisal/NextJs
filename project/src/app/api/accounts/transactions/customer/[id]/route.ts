import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCustomerTransaction } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    // Get customer with transactions
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50 // Limit to last 50 transactions
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      customer: {
        id: customer.id,
        CompanyName: customer.CompanyName,
        PersonName: customer.PersonName,
        currentBalance: customer.currentBalance,
        creditLimit: customer.creditLimit
      },
      transactions: customer.transactions
    });

  } catch (error) {
    console.error("Error fetching customer transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer transactions" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
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

    const result = await addCustomerTransaction(
      prisma,
      customerId,
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
    console.error("Error adding customer transaction:", error);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}
