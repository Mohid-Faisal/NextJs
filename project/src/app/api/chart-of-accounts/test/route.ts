import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Check if any accounts exist
    const accountCount = await prisma.chartOfAccount.count();
    
    // Get a few sample accounts
    const sampleAccounts = await prisma.chartOfAccount.findMany({
      take: 5,
      orderBy: { code: "asc" }
    });

    return NextResponse.json({
      success: true,
      accountCount,
      sampleAccounts,
      message: accountCount === 0 ? "No chart of accounts found. Please initialize them first." : `${accountCount} accounts found.`
    });
  } catch (error) {
    console.error("Error checking chart of accounts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check chart of accounts" },
      { status: 500 }
    );
  }
}
