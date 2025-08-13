import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCompanyTransaction } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    // Get company account with transactions
    let companyAccount = await prisma.companyAccount.findFirst({
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50 // Limit to last 50 transactions
        }
      }
    });

    if (!companyAccount) {
      // Create default company account if it doesn't exist
      companyAccount = await prisma.companyAccount.create({
        data: {
          name: "Main Company Account",
          currentBalance: 0
        },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 50
          }
        }
      });
    }

    return NextResponse.json({
      account: {
        id: companyAccount.id,
        name: companyAccount.name,
        currentBalance: companyAccount.currentBalance
      },
      transactions: companyAccount.transactions
    });

  } catch (error) {
    console.error("Error fetching company account:", error);
    return NextResponse.json(
      { error: "Failed to fetch company account" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const result = await addCompanyTransaction(
      prisma,
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
    console.error("Error adding company transaction:", error);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}
