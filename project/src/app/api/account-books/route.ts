import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const category = searchParams.get('category');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? undefined : parseInt(limitParam || '1000') || 1000;

    // Build where clause for filtering
    const whereClause: any = {};

    // Filter by category
    if (category) {
      whereClause.category = category;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) {
        whereClause.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.date.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // Check if there are any payments first
    const totalCount = await prisma.payment.count({
      where: whereClause,
    });

    const payments = await prisma.payment.findMany({
      where: whereClause,
      orderBy: {
        date: 'desc',
      },
      ...(limit && { take: limit }),
    });

    return NextResponse.json({
      success: true,
      payments: payments,
      total: totalCount,
    });
  } catch (error) {
    console.error("Error fetching account book entries:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch account book entries" },
      { status: 500 }
    );
  }
}
