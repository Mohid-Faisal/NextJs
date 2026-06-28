import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const accountCount = await prisma.chartOfAccount.count({
      where: orgWhere(session),
    });

    const sampleAccounts = await prisma.chartOfAccount.findMany({
      where: orgWhere(session),
      take: 5,
      orderBy: { code: "asc" },
    });

    return NextResponse.json({
      success: true,
      accountCount,
      sampleAccounts,
      message:
        accountCount === 0
          ? "No chart of accounts found. Please initialize them first."
          : `${accountCount} accounts found.`,
    });
  } catch (error) {
    console.error("Error checking chart of accounts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check chart of accounts" },
      { status: 500 }
    );
  }
}
