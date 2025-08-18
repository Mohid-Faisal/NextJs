import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCompanyTransaction } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const sortField = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get company account info
    let companyAccount = await prisma.companyAccount.findFirst({
      select: {
        id: true,
        name: true,
        currentBalance: true
      }
    });

    if (!companyAccount) {
      // Create default company account if it doesn't exist
      companyAccount = await prisma.companyAccount.create({
        data: {
          name: "Main Company Account",
          currentBalance: 0
        },
        select: {
          id: true,
          name: true,
          currentBalance: true
        }
      });
    }

    // Build where clause for filtering
    const whereClause: any = {
      accountId: companyAccount.id
    };

    // Add search filter
    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { amount: { equals: parseFloat(search) || undefined } }
      ];
    }

    // Add date range filter
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) {
        whereClause.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        whereClause.createdAt.lte = new Date(toDate);
      }
    }

    // Validate sort field
    const allowedSortFields = ['createdAt', 'amount', 'type', 'description', 'reference'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'createdAt';
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    // Get total count for pagination
    const total = await prisma.companyTransaction.count({
      where: whereClause
    });

    // Get transactions with pagination and filtering
    const transactions = await prisma.companyTransaction.findMany({
      where: whereClause,
      orderBy: { [validSortField]: validSortOrder },
      skip,
      take: limit
    });

    return NextResponse.json({
      account: {
        id: companyAccount.id,
        name: companyAccount.name,
        currentBalance: companyAccount.currentBalance
      },
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
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
