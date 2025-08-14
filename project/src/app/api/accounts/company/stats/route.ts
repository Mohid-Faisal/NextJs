import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
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
      where: {
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
      },
      _sum: {
        amount: true
      }
    });

    // Get cash outflow (EXPENSE transactions from payments with CASH mode + transfers FROM cash)
    const cashOutflow = await prisma.payment.aggregate({
      where: {
        ...dateFilter,
        OR: [
          {
            mode: "CASH",
            transactionType: "EXPENSE"
          },
          {
            mode: "CASH",
            transactionType: "RETURN"
          },
          {
            transactionType: "TRANSFER",
            description: {
              contains: "Cash to Bank"
            }
          }
        ]
      },
      _sum: {
        amount: true
      }
    });

    // Get bank inflow (CREDIT transactions from payments with BANK_TRANSFER mode + transfers TO bank)
    const bankInflow = await prisma.payment.aggregate({
      where: {
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
      },
      _sum: {
        amount: true
      }
    });

    // Get bank outflow (EXPENSE transactions from payments with BANK_TRANSFER mode + transfers FROM bank)
    const bankOutflow = await prisma.payment.aggregate({
      where: {
        ...dateFilter,
        OR: [
          {
            mode: "BANK_TRANSFER",
            transactionType: "EXPENSE"
          },
          {
            mode: "BANK_TRANSFER",
            transactionType: "RETURN"
          },
          {
            transactionType: "TRANSFER",
            description: {
              contains: "Bank to Cash"
            }
          }
        ]
      },
      _sum: {
        amount: true
      }
    });

    const stats = {
      cash: {
        inflow: cashInflow._sum.amount || 0,
        outflow: cashOutflow._sum.amount || 0,
        net: (cashInflow._sum.amount || 0) - (cashOutflow._sum.amount || 0)
      },
      bank: {
        inflow: bankInflow._sum.amount || 0,
        outflow: bankOutflow._sum.amount || 0,
        net: (bankInflow._sum.amount || 0) - (bankOutflow._sum.amount || 0)
      },
      total: {
        inflow: (cashInflow._sum.amount || 0) + (bankInflow._sum.amount || 0),
        outflow: (cashOutflow._sum.amount || 0) + (bankOutflow._sum.amount || 0),
        net: 0 // Will be calculated below
      }
    };

    stats.total.net = stats.total.inflow - stats.total.outflow;

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
