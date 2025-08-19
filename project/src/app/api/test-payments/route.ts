import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Get total count
    const totalCount = await prisma.payment.count();
    
    // Get first few payments to see structure
    const payments = await prisma.payment.findMany({
      take: 5,
      orderBy: {
        date: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      totalCount,
      samplePayments: payments,
      message: `Found ${totalCount} payments in database`
    });
  } catch (error) {
    console.error("Error testing payments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test payments" },
      { status: 500 }
    );
  }
}
