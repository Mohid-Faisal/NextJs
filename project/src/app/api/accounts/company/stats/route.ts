import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "view_revenue");
    if (auth.error) return auth.error;
    const session = auth.session;

    // Get date range from query parameters (default to current month)
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      };
    } else {
      // Default to current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      dateFilter = {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      };
    }

    // Get cash inflow (CREDIT transactions from payments with CASH mode + transfers TO cash)
    const cashInflow = await prisma.payment.aggregate({
      where: orgWhere(session, {
        ...dateFilter,
        OR: [
          {
            mode: "CASH",
            transactionType: "INCOME"
          },
          {
            transactionType: "TRANSFER",
            description: {
              contains: "Bank to Cash"
            }
          }
        ]
      }),
      _sum: {
        amount: true
      }
    });

    // Get cash outflow (EXPENSE transactions from payments with CASH mode + transfers FROM cash)
    const cashOutflow = await prisma.payment.aggregate({
      where: orgWhere(session, {
        ...dateFilter,
        OR: [
          {
            mode: "CASH",
            transactionType: "EXPENSE"
          },
          {
            mode: "CASH",
            transactionType: "ADJUSTMENT"
          },
          {
            transactionType: "TRANSFER",
            description: {
              contains: "Cash to Bank"
            }
          }
        ]
      }),
      _sum: {
        amount: true
      }
    });

    // Get bank inflow (CREDIT transactions from payments with BANK_TRANSFER mode + transfers TO bank)
    const bankInflow = await prisma.payment.aggregate({
      where: orgWhere(session, {
        ...dateFilter,
        OR: [
          {
            mode: "BANK_TRANSFER",
            transactionType: "INCOME"
          },
          {
            transactionType: "TRANSFER",
            description: {
              contains: "Cash to Bank"
            }
          }
        ]
      }),
      _sum: {
        amount: true
      }
    });

    // Get bank outflow (EXPENSE transactions from payments with BANK_TRANSFER mode + transfers FROM bank)
    const bankOutflow = await prisma.payment.aggregate({
      where: orgWhere(session, {
        ...dateFilter,
        OR: [
          {
            mode: "BANK_TRANSFER",
            transactionType: "EXPENSE"
          },
          {
            mode: "BANK_TRANSFER",
            transactionType: "ADJUSTMENT"
          },
          {
            transactionType: "TRANSFER",
            description: {
              contains: "Bank to Cash"
            }
          }
        ]
      }),
      _sum: {
        amount: true
      }
    });

    const cashIn = Number(cashInflow._sum.amount || 0);
    const cashOut = Number(cashOutflow._sum.amount || 0);
    const bankIn = Number(bankInflow._sum.amount || 0);
    const bankOut = Number(bankOutflow._sum.amount || 0);

    const stats = {
      cash: {
        inflow: cashIn,
        outflow: cashOut,
        net: cashIn - cashOut
      },
      bank: {
        inflow: bankIn,
        outflow: bankOut,
        net: bankIn - bankOut
      },
      total: {
        inflow: cashIn + bankIn,
        outflow: cashOut + bankOut,
        net: (cashIn + bankIn) - (cashOut + bankOut)
      }
    };

    return NextResponse.json({
      success: true,
      stats,
      dateRange: dateFilter
    });

  } catch (error) {
    console.error("Error fetching company stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch company statistics" },
      { status: 500 }
    );
  }
}
