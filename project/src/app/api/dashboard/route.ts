import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCountryNameFromCode } from "@/lib/utils";
import { computeMonthlyPartyNetsUsingVoucherDates } from "@/lib/accounts/dashboardVoucherBalances";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";
import type { PrismaClient } from "@prisma/client";
import { money } from "@/lib/money";
import { reportError } from "@/lib/logger";

/**
 * For a calendar period: gross of customer invoices created in that period,
 * minus customer (INCOME) payments dated in the same period that reference those invoice numbers.
 * This is the net â€œstill to collectâ€ from invoicing activity in that month (floored at 0).
 */
async function netCustomerInvoicedReceivableForPeriod(
  prismaClient: PrismaClient,
  organizationId: number,
  rangeStart: Date,
  rangeEndExclusive: Date
): Promise<number> {
  const monthInvoices = await prismaClient.invoice.findMany({
    where: {
      organizationId,
      customerId: { not: null },
      status: { not: "Cancelled" },
      createdAt: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
    },
    select: {
      invoiceNumber: true,
      totalAmount: true,
      status: true,
    },
  });

  if (monthInvoices.length === 0) return 0;

  // Batch payment sums for all Partial invoices in one grouped query instead
  // of aggregating per invoice.
  const partialInvoiceNumbers = monthInvoices
    .filter((inv) => inv.status === "Partial" && inv.invoiceNumber)
    .map((inv) => inv.invoiceNumber as string);

  const paidByInvoice = new Map<string, number>();
  if (partialInvoiceNumbers.length > 0) {
    const paymentSums = await prismaClient.payment.groupBy({
      by: ["invoice"],
      where: {
        organizationId,
        transactionType: "INCOME",
        fromCustomerId: { not: null },
        invoice: { in: partialInvoiceNumbers },
      },
      _sum: {
        amount: true,
      },
    });
    for (const row of paymentSums) {
      if (row.invoice) paidByInvoice.set(row.invoice, money(row._sum.amount));
    }
  }

  let totalNetReceivable = 0;

  for (const inv of monthInvoices) {
    let remaining = 0;
    if (inv.status === "Unpaid") {
      remaining = money(inv.totalAmount);
    } else if (inv.status === "Partial") {
      const totalPaid = inv.invoiceNumber
        ? paidByInvoice.get(inv.invoiceNumber) || 0
        : 0;
      remaining = Math.max(0, money(inv.totalAmount) - totalPaid);
    } else {
      // Paid or others
      remaining = 0;
    }
    totalNetReceivable += remaining;
  }

  return Math.round(totalNetReceivable * 100) / 100;
}

export async function GET(req: Request) {
  try {
    const auth = await requirePermission(req, "view_dashboard");
    if (auth.error) return auth.error;
    const session = auth.session;
    const org = (extra: Record<string, unknown> = {}) => orgWhere(session, extra);

    const currentOrg = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { currency: true }
    });
    const currency = currentOrg?.currency || "PKR";

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // Batch independent counts / aggregates in parallel.
    // Active users: the former HTTP self-call to /api/user-activity tracked an
    // in-process map; its DB fallback (users with ACTIVE status) is inlined
    // here as a direct query instead.
    const [
      totalShipments,
      totalUsers,
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      activeStatusUsers,
      totalRevenueResult,
      newOrders,
    ] = await Promise.all([
      prisma.shipment.count({ where: org() }),
      prisma.user.count(),
      prisma.customers.count({ where: org() }),
      prisma.customers.count({ where: org({ ActiveStatus: "Active" }) }),
      prisma.customers.count({ where: org({ ActiveStatus: "Inactive" }) }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.invoice.aggregate({
        where: org({
          customerId: { not: null },
          status: { not: "Cancelled" },
        }),
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.shipment.count({
        where: org({
          shipmentDate: {
            gte: new Date(currentYear, currentMonth, 1),
            lt: new Date(currentYear, currentMonth + 1, 1),
          },
        }),
      }),
    ]);

    let activeUsers = activeStatusUsers;

    // If no active users found, fall back to total users
    if (activeUsers === 0) {
      activeUsers = totalUsers;
    }
    
    // Use activeUsers if we have them, otherwise fall back to totalUsers
    const currentActiveUsers = activeUsers > 0 ? activeUsers : totalUsers;

    const totalRevenue = money(totalRevenueResult._sum.totalAmount);
    
    // Get monthly earnings for the current year (using shipmentDate from related shipments)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyEarnings = await Promise.all(
      Array.from({ length: 12 }, async (_, month) => {
        const startDate = new Date(currentYear, month, 1);
        const endDate = new Date(currentYear, month + 1, 1);

        // Get invoices with their related shipments, then filter by shipmentDate
        const result = await prisma.invoice.aggregate({
          where: org({
            customerId: { not: null },
            status: { not: "Cancelled" },
            shipment: {
              shipmentDate: {
                gte: startDate,
                lt: endDate
              }
            }
          }),
          _sum: {
            totalAmount: true
          }
        });

        return {
          month: monthNames[month],
          earnings: money(result._sum.totalAmount)
        };
      })
    );
    
    // Get recent shipments with real data (ordered by shipmentDate)
    const recentShipments = await prisma.shipment.findMany({
      where: org(),
      take: 10,
      orderBy: {
        shipmentDate: 'desc'
      },
      select: {
        id: true,
        trackingId: true,
        invoiceNumber: true,
        senderName: true,
        recipientName: true,
        destination: true,
        totalCost: true,
        deliveryStatus: true,
        invoiceStatus: true,
        packaging: true,
        amount: true,
        totalWeight: true,
        weight: true,
        shipmentDate: true,
        createdAt: true,
        serviceMode: true
      }
    });
    
    // Get invoice statuses for all shipments
    const invoiceNumbers = recentShipments
      .map((s) => s.invoiceNumber)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
    const invoices = await prisma.invoice.findMany({
      where: org({
        invoiceNumber: {
          in: invoiceNumbers,
        },
      }),
      select: {
        invoiceNumber: true,
        status: true
      }
    });
    
    // Create a map of invoiceNumber -> status for quick lookup
    const invoiceStatusMap = new Map(
      invoices.map(inv => [inv.invoiceNumber, inv.status])
    );
    
    // Transform recent shipments to match expected format
    const transformedRecentShipments = recentShipments.map(shipment => {
      // Get invoice status from Invoice table, fallback to shipment's invoiceStatus, then "Unpaid"
      const invNum = shipment.invoiceNumber ?? "";
      const invoiceStatus =
        (invNum ? invoiceStatusMap.get(invNum) : undefined) ||
        shipment.invoiceStatus ||
        "Unpaid";
      
      // Convert country code to full country name
      const destinationCountry = shipment.destination 
        ? getCountryNameFromCode(shipment.destination) 
        : shipment.destination || "N/A";
      
      return {
        id: shipment.id,
        trackingId: shipment.trackingId,
        invoiceNumber: shipment.invoiceNumber,
        senderName: shipment.senderName,
        recipientName: shipment.recipientName,
        destination: destinationCountry,
        totalCost: money(shipment.totalCost),
        status: shipment.deliveryStatus || "Pending",
        invoiceStatus: invoiceStatus,
        packaging: shipment.packaging || "N/A",
        amount: shipment.amount || 1,
        totalWeight: shipment.totalWeight || shipment.weight || 0,
        shipmentDate: shipment.shipmentDate || shipment.createdAt,
        createdAt: shipment.createdAt.toISOString(),
        serviceMode: shipment.serviceMode
      };
    });
    
    // Get recent payments from the main Payment table
    const recentPayments = await prisma.payment.findMany({
      where: org(),
      take: 10,
      orderBy: {
        date: 'desc'
      },
      select: {
        id: true,
        transactionType: true,
        amount: true,
        description: true,
        reference: true,
        invoice: true,
        date: true,
        category: true,
        mode: true,
        fromPartyType: true,
        fromCustomer: true,
        toPartyType: true,
        toVendor: true
      }
    });
    
    // Transform payments to match expected format
    const transformedPayments = recentPayments.map(payment => {
      // Determine party name and type based on transaction type
      let partyName = '';
      let partyType = '';
      
      if (payment.transactionType === 'INCOME') {
        // Income means money coming in (from customer to us)
        partyName = payment.fromCustomer || 'Customer';
        partyType = 'Customer';
      } else if (payment.transactionType === 'EXPENSE') {
        // Expense means money going out (from us to vendor)
        partyName = payment.toVendor || 'Vendor';
        partyType = 'Vendor';
      } else {
        // For other transaction types, show both parties
        partyName = `${payment.fromCustomer || 'N/A'} â†’ ${payment.toVendor || 'N/A'}`;
        partyType = 'Transfer';
      }
      
      return {
        id: payment.id,
        type: payment.transactionType,
        amount: money(payment.amount),
        description: payment.description || payment.category || 'Payment',
        reference: payment.reference || 'N/A',
        invoice: payment.invoice || 'N/A',
        previousBalance: 0, // Not available in Payment model
        newBalance: 0, // Not available in Payment model
        partyName: partyName,
        partyType: partyType,
        paymentMode: payment.mode || 'N/A',
        category: payment.category,
        createdAt: payment.date.toISOString()
      };
    });
    
    // Get shipment status distribution
    const shipmentStatuses = await prisma.shipment.groupBy({
      by: ['deliveryStatus'],
      where: org(),
      _count: {
        id: true
      }
    });
    
    const shipmentStatusDistribution = shipmentStatuses.map(status => ({
      status: status.deliveryStatus || "Pending",
      count: status._count.id,
      color: getStatusColor(status.deliveryStatus || "Pending")
    }));
    
    const destAgg = await prisma.$queryRaw<
      Array<{ destination: string; revenue: unknown; shipments: bigint | number }>
    >`
      SELECT s.destination AS destination,
             COALESCE(SUM(inv.inv_total), 0) AS revenue,
             COUNT(*) AS shipments
      FROM Shipment s
      LEFT JOIN (
        SELECT shipmentId, SUM(totalAmount) AS inv_total
        FROM Invoice
        WHERE organizationId = ${session.organizationId}
          AND customerId IS NOT NULL
          AND status <> 'Cancelled'
          AND shipmentId IS NOT NULL
        GROUP BY shipmentId
      ) inv ON inv.shipmentId = s.id
      WHERE s.organizationId = ${session.organizationId}
        AND s.destination IS NOT NULL
        AND TRIM(s.destination) <> ''
      GROUP BY s.destination
    `;

    const destShipmentCounts = destAgg.map((row) => {
      const destination = row.destination;
      const revenue = money(row.revenue);
      const shipments = Number(row.shipments) || 0;
      return { destination, revenue, shipments };
    });

    const transformedRevenueByDestination = [...destShipmentCounts].sort(
      (a, b) => b.revenue - a.revenue
    );
    
    // Get monthly shipments count for last 12 months (using shipmentDate)
    const currentDate = new Date();
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const monthlyShipments = await Promise.all(
      Array.from({ length: 12 }, async (_, idx) => {
        const i = 11 - idx;
        const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);

        const [monthShipments, monthRevenueAgg] = await Promise.all([
          prisma.shipment.count({
            where: org({
              shipmentDate: {
                gte: startDate,
                lt: endDate
              }
            }),
          }),
          prisma.invoice.aggregate({
            where: org({
              customerId: { not: null },
              status: { not: "Cancelled" },
              shipment: {
                shipmentDate: {
                  gte: startDate,
                  lt: endDate
                }
              }
            }),
            _sum: { totalAmount: true },
          }),
        ]);

        return {
          month: `${monthNamesShort[targetDate.getMonth()]} ${targetDate.getFullYear().toString().slice(-2)}`,
          shipments: monthShipments,
          revenue: money(monthRevenueAgg._sum.totalAmount)
        };
      })
    );

    const topDestinationsWithRevenue = [...destShipmentCounts]
      .sort((a, b) => b.shipments - a.shipments)
      .slice(0, 5);
    
    const transformedTopDestinations = topDestinationsWithRevenue;

    const invoiceStatsByCustomer = await prisma.invoice.groupBy({
      by: ["customerId"],
      where: org({
        customerId: { not: null },
        status: { not: "Cancelled" },
      }),
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const rankedCustomerStats = invoiceStatsByCustomer
      .filter((row): row is typeof row & { customerId: number } => row.customerId != null)
      .sort((a, b) => b._count.id - a._count.id);

    const topCustomerStats = rankedCustomerStats.slice(0, 25);
    const topCustomerIds = topCustomerStats.map((row) => row.customerId);
    const destMapCustomerIds = topCustomerIds.slice(0, 8);

    const [topCustomerRows, destMapInvoices, lastShipmentRows, receivableRows, totalDelivered, failedShipments, deliveredSample] =
      await Promise.all([
        topCustomerIds.length > 0
          ? prisma.customers.findMany({
              where: org({ id: { in: topCustomerIds } }),
              select: { id: true, CompanyName: true, currentBalance: true },
            })
          : Promise.resolve([]),
        destMapCustomerIds.length > 0
          ? prisma.invoice.findMany({
              where: org({
                customerId: { in: destMapCustomerIds },
                status: { not: "Cancelled" },
              }),
              select: { customerId: true, destination: true },
            })
          : Promise.resolve([]),
        topCustomerIds.length > 0
          ? prisma.invoice.findMany({
              where: org({
                customerId: { in: topCustomerIds },
                status: { not: "Cancelled" },
                shipmentId: { not: null },
              }),
              select: {
                customerId: true,
                shipment: { select: { shipmentDate: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 250,
            })
          : Promise.resolve([]),
        prisma.customers.findMany({
          where: org({ currentBalance: { lt: 0 } }),
          orderBy: { currentBalance: "asc" },
          take: 25,
          select: { id: true, CompanyName: true, currentBalance: true },
        }),
        prisma.shipment.count({
          where: org({ deliveryStatus: "Delivered" }),
        }),
        prisma.shipment.count({
          where: org({ deliveryStatus: "Failed" }),
        }),
        prisma.shipment.findMany({
          where: org({ deliveryStatus: "Delivered" }),
          select: { createdAt: true, shipmentDate: true },
          orderBy: { shipmentDate: "desc" },
          take: 500,
        }),
      ]);

    const customerById = new Map(topCustomerRows.map((c) => [c.id, c]));
    const lastShipmentByCustomer = new Map<number, Date>();
    for (const row of lastShipmentRows) {
      if (row.customerId == null || !row.shipment?.shipmentDate) continue;
      const existing = lastShipmentByCustomer.get(row.customerId);
      if (!existing || row.shipment.shipmentDate > existing) {
        lastShipmentByCustomer.set(row.customerId, row.shipment.shipmentDate);
      }
    }

    const transformedTopCustomers = topCustomerStats
      .map((stat) => {
        const customer = customerById.get(stat.customerId);
        if (!customer) return null;
        const shipments = stat._count.id;
        const totalSpent = money(stat._sum.totalAmount);
        const last = lastShipmentByCustomer.get(stat.customerId);
        return {
          customer: customer.CompanyName,
          shipments,
          totalSpent,
          avgOrderValue: shipments > 0 ? totalSpent / shipments : 0,
          currentBalance: money(customer.currentBalance),
          lastShipmentDate: last ? last.toISOString() : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const destCountsByCustomer = new Map<number, Record<string, number>>();
    for (const inv of destMapInvoices) {
      if (inv.customerId == null) continue;
      const bucket = destCountsByCustomer.get(inv.customerId) ?? {};
      bucket[inv.destination] = (bucket[inv.destination] || 0) + 1;
      destCountsByCustomer.set(inv.customerId, bucket);
    }

    const transformedCustomerDestinationMap = destMapCustomerIds
      .map((id) => {
        const customer = customerById.get(id);
        const counts = destCountsByCustomer.get(id);
        if (!customer || !counts) return null;
        const preferredDestination =
          Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || "Unknown";
        const shipments = Object.values(counts).reduce((sum, n) => sum + n, 0);
        return {
          customer: customer.CompanyName,
          destination: preferredDestination,
          shipments,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const receivableCountById = new Map(
      rankedCustomerStats.map((row) => [row.customerId, row._count.id])
    );
    const receivableSpentById = new Map(
      rankedCustomerStats.map((row) => [row.customerId, money(row._sum.totalAmount)])
    );
    const receivableCustomers = receivableRows.map((c) => {
      const shipments = receivableCountById.get(c.id) || 0;
      const totalSpent = receivableSpentById.get(c.id) || 0;
      return {
        customer: c.CompanyName,
        shipments,
        totalSpent,
        avgOrderValue: shipments > 0 ? totalSpent / shipments : 0,
        currentBalance: money(c.currentBalance),
        lastShipmentDate: null as string | null,
      };
    });
    
    const deliveryRate = totalShipments > 0 ? (totalDelivered / totalShipments) * 100 : 0;

    let avgDeliveryTime = 0;
    if (deliveredSample.length > 0) {
      const totalDays = deliveredSample.reduce((sum, shipment) => {
        const daysDiff = Math.ceil(
          (shipment.shipmentDate.getTime() - shipment.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return sum + Math.max(0, daysDiff);
      }, 0);
      avgDeliveryTime =
        totalDays > 0 ? Math.round((totalDays / deliveredSample.length) * 10) / 10 : 0;
    }

    let customerSatisfaction = 0;
    if (totalShipments > 0) {
      const successRate = ((totalShipments - failedShipments) / totalShipments) * 100;
      if (successRate >= 90) customerSatisfaction = 5.0;
      else if (successRate >= 80) customerSatisfaction = 4.5;
      else if (successRate >= 70) customerSatisfaction = 4.0;
      else if (successRate >= 60) customerSatisfaction = 3.5;
      else if (successRate >= 50) customerSatisfaction = 3.0;
      else customerSatisfaction = 2.5;
    }
    
    // This month / last month: net invoiced receivable (new customer invoices minus payments this period toward those invoices)
    const curMonthStart = new Date(currentYear, currentMonth, 1);
    const curMonthEnd = new Date(currentYear, currentMonth + 1, 1);
    const prevMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthEnd = new Date(currentYear, currentMonth, 1);

    // Batch the independent month-over-month growth queries, accounts
    // payable/receivable aggregates, and period receivables in parallel.
    const [
      currentMonthRevenueAgg,
      previousMonthRevenueAgg,
      currentMonthShipments,
      previousMonthShipments,
      currentMonthCustomers,
      previousMonthCustomers,
      accountsReceivableResult,
      accountsPayableResult,
      currentMonthReceivableAmount,
      previousMonthReceivableAmount,
    ] = await Promise.all([
      // Revenue growth (comparing current month with previous month using shipmentDate)
      prisma.invoice.aggregate({
        where: org({
          customerId: { not: null },
          status: { not: "Cancelled" },
          shipment: {
            shipmentDate: {
              gte: new Date(currentYear, currentMonth, 1),
              lt: new Date(currentYear, currentMonth + 1, 1)
            }
          }
        }),
        _sum: { totalAmount: true }
      }),
      prisma.invoice.aggregate({
        where: org({
          customerId: { not: null },
          status: { not: "Cancelled" },
          shipment: {
            shipmentDate: {
              gte: new Date(currentYear, currentMonth - 1, 1),
              lt: new Date(currentYear, currentMonth, 1)
            }
          }
        }),
        _sum: { totalAmount: true }
      }),
      // Shipment growth rate (comparing current month with previous month using shipmentDate)
      prisma.shipment.count({
        where: org({
          shipmentDate: {
            gte: new Date(currentYear, currentMonth, 1),
            lt: new Date(currentYear, currentMonth + 1, 1)
          }
        }),
      }),
      prisma.shipment.count({
        where: org({
          shipmentDate: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1)
          }
        }),
      }),
      // Customer growth rate
      prisma.customers.count({
        where: org({
          createdAt: {
            gte: new Date(currentYear, currentMonth, 1),
            lt: new Date(currentYear, currentMonth + 1, 1)
          }
        }),
      }),
      prisma.customers.count({
        where: org({
          createdAt: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1)
          }
        }),
      }),
      // Accounts payable and receivable
      // Note: Customer balances are negative when they owe us money (accounts receivable)
      // Vendor balances are positive when we owe them money (accounts payable)
      prisma.customers.aggregate({
        where: org({
          currentBalance: {
            lt: 0
          }
        }),
        _sum: {
          currentBalance: true
        }
      }),
      prisma.vendors.aggregate({
        where: org({
          currentBalance: {
            gt: 0
          }
        }),
        _sum: {
          currentBalance: true
        }
      }),
      netCustomerInvoicedReceivableForPeriod(
        prisma,
        session.organizationId,
        curMonthStart,
        curMonthEnd
      ),
      netCustomerInvoicedReceivableForPeriod(
        prisma,
        session.organizationId,
        prevMonthStart,
        prevMonthEnd
      ),
    ]);

    const currentMonthTotal = money(currentMonthRevenueAgg._sum.totalAmount);
    const previousMonthTotal = money(previousMonthRevenueAgg._sum.totalAmount);
    const revenueGrowth = previousMonthTotal > 0 ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100 : 0;

    const shipmentGrowth = previousMonthShipments > 0 ? ((currentMonthShipments - previousMonthShipments) / previousMonthShipments) * 100 : 0;

    const customerGrowth = previousMonthCustomers > 0 ? ((currentMonthCustomers - previousMonthCustomers) / previousMonthCustomers) * 100 : 0;

    const totalReceivable = Math.abs(money(accountsReceivableResult._sum.currentBalance));
    const totalPayable = money(accountsPayableResult._sum.currentBalance);
    
    // Last 12 months: nets from ledger using voucher dates (shipment / payment / note dates), same rules as accounts transaction pages
    const currentDateForAccounts = new Date();
    const monthNamesForAccounts = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthSlices: { targetDate: Date; endExclusive: Date }[] = [];
    const y0 = currentDateForAccounts.getUTCFullYear();
    const m0 = currentDateForAccounts.getUTCMonth();
    for (let i = 11; i >= 0; i--) {
      const mi = m0 - i;
      const targetDate = new Date(Date.UTC(y0, mi, 1));
      const endExclusive = new Date(Date.UTC(y0, mi + 1, 1));
      monthSlices.push({ targetDate, endExclusive });
    }

    const voucherMonthNets = await computeMonthlyPartyNetsUsingVoucherDates(
      prisma,
      session.organizationId,
      monthSlices.map((s) => s.endExclusive)
    );

    const monthlyAccountsData: {
      month: string;
      receivable: number;
      payable: number;
    }[] = monthSlices.map(({ targetDate }, i) => {
      const net = voucherMonthNets[i] || { customerNet: 0, vendorNet: 0 };
      const cNet = money(net.customerNet);
      const vNet = money(net.vendorNet);
      return {
        month: `${monthNamesForAccounts[targetDate.getUTCMonth()]} ${targetDate.getUTCFullYear().toString().slice(-2)}`,
        receivable: Math.abs(Math.min(cNet, 0)),
        payable: Math.max(vNet, 0),
      };
    });

    // If all months returned 0 (e.g. no historical customerTransaction rows), fallback to Invoice aggregates
    const allZero = monthlyAccountsData.every((d) => d.receivable === 0 && d.payable === 0);
    if (allZero) {
      const invoiceDataByMonth = await Promise.all(
        monthSlices.map(async ({ targetDate, endExclusive }) => {
          const [customerInv, vendorInv] = await Promise.all([
            prisma.invoice.aggregate({
              where: org({
                customerId: { not: null },
                status: { not: "Cancelled" },
                createdAt: {
                  gte: targetDate,
                  lt: endExclusive,
                },
              }),
              _sum: { totalAmount: true },
            }),
            prisma.invoice.aggregate({
              where: org({
                vendorId: { not: null },
                status: { not: "Cancelled" },
                createdAt: {
                  gte: targetDate,
                  lt: endExclusive,
                },
              }),
              _sum: { totalAmount: true },
            }),
          ]);

          return {
            receivable: money(customerInv._sum.totalAmount),
            payable: money(vendorInv._sum.totalAmount),
          };
        })
      );

      invoiceDataByMonth.forEach((invData, i) => {
        monthlyAccountsData[i].receivable = invData.receivable;
        monthlyAccountsData[i].payable = invData.payable;
      });
    }
    
    // Calculate percentage changes for metric cards
    const calculatePercentageChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };
    
    // Calculate shipment percentage change (comparing current month with previous month)
    const shipmentPercentageChange = calculatePercentageChange(currentMonthShipments, previousMonthShipments);
    
    // Calculate customer percentage change
    const customerPercentageChange = calculatePercentageChange(currentMonthCustomers, previousMonthCustomers);
    
    // Calculate revenue percentage change
    const revenuePercentageChange = calculatePercentageChange(currentMonthTotal, previousMonthTotal);

    // MoM change for net invoiced receivable (matches currentMonthData.accountsReceivable)
    const receivablePercentageChange = calculatePercentageChange(
      currentMonthReceivableAmount,
      previousMonthReceivableAmount
    );
    
    // Get deliveries by country (only delivered shipments)
    const deliveriesByCountry = await prisma.shipment.groupBy({
      by: ['destination'],
      where: org({ deliveryStatus: 'Delivered' }),
      _count: {
        id: true
      }
    });
    
    const transformedDeliveriesByCountry = deliveriesByCountry.map(item => ({
      country: item.destination,
      deliveries: item._count.id
    }));
    
    const data = {
      totalShipments,
      totalUsers: currentActiveUsers, // Show active users instead of total users
      totalRevenue,
      newOrders,
      monthlyEarnings,
      recentShipments: transformedRecentShipments,
      recentPayments: transformedPayments,
      shipmentStatusDistribution,
      revenueByDestination: transformedRevenueByDestination,
      monthlyShipments,
      topDestinations: transformedTopDestinations,
      customerDestinationMap: transformedCustomerDestinationMap,
      topCustomers: transformedTopCustomers,
      performanceMetrics: {
        deliveryRate: Math.round(deliveryRate * 10) / 10,
        avgDeliveryTime,
        customerSatisfaction,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10
      },
      growthMetrics: {
        shipmentGrowth: Math.round(shipmentGrowth * 10) / 10,
        customerGrowth: Math.round(customerGrowth * 10) / 10
      },
      percentageChanges: {
        shipmentPercentageChange,
        customerPercentageChange,
        revenuePercentageChange,
        receivablePercentageChange,
      },
      accountsData: {
        accountsReceivable: totalReceivable,
        accountsPayable: totalPayable,
        receivableCustomers,
        monthlyAccountsData
      },
      currentMonthData: {
        revenue: currentMonthTotal,
        shipments: currentMonthShipments,
        accountsReceivable: currentMonthReceivableAmount,
        customers: currentMonthCustomers
      },
      deliveriesByCountry: transformedDeliveriesByCountry
    };
    
    // Ensure all arrays have data, if not provide fallback data
    const finalData = {
      currency: currency || "PKR",
      totalShipments: totalShipments || 0,
      totalUsers: currentActiveUsers || 0, // Show active users instead of total users
      totalCustomers: totalCustomers || 0,
      activeCustomers: activeCustomers || 0,
      inactiveCustomers: inactiveCustomers || 0,
      totalRevenue: totalRevenue || 0,
      newOrders: newOrders || 0,
      monthlyEarnings: monthlyEarnings.length > 0 ? monthlyEarnings : [
        { month: "Jan", earnings: 0 },
        { month: "Feb", earnings: 0 },
        { month: "Mar", earnings: 0 },
        { month: "Apr", earnings: 0 },
        { month: "May", earnings: 0 },
        { month: "Jun", earnings: 0 },
        { month: "Jul", earnings: 0 },
        { month: "Aug", earnings: 0 },
        { month: "Sep", earnings: 0 },
        { month: "Oct", earnings: 0 },
        { month: "Nov", earnings: 0 },
        { month: "Dec", earnings: 0 }
      ],
      recentShipments: transformedRecentShipments.length > 0 ? transformedRecentShipments : [],
      recentPayments: transformedPayments.length > 0 ? transformedPayments : [],
      shipmentStatusDistribution: shipmentStatusDistribution.length > 0 ? shipmentStatusDistribution : [
        { status: "Pending", count: 0, color: "#F59E0B" }
      ],
      revenueByDestination: transformedRevenueByDestination.length > 0 ? transformedRevenueByDestination : [
        { destination: "No Data", revenue: 0, shipments: 0 }
      ],
      monthlyShipments: monthlyShipments.length > 0 ? monthlyShipments : [
        { month: "Jan", shipments: 0, revenue: 0 },
        { month: "Feb", shipments: 0, revenue: 0 },
        { month: "Mar", shipments: 0, revenue: 0 },
        { month: "Apr", shipments: 0, revenue: 0 },
        { month: "May", shipments: 0, revenue: 0 },
        { month: "Jun", shipments: 0, revenue: 0 },
        { month: "Jul", shipments: 0, revenue: 0 },
        { month: "Aug", shipments: 0, revenue: 0 },
        { month: "Sep", shipments: 0, revenue: 0 },
        { month: "Oct", shipments: 0, revenue: 0 },
        { month: "Nov", shipments: 0, revenue: 0 },
        { month: "Dec", shipments: 0, revenue: 0 }
      ],
      topDestinations: transformedTopDestinations.length > 0 ? transformedTopDestinations : [
        { destination: "No Data", shipments: 0, revenue: 0 }
      ],
      customerDestinationMap: transformedCustomerDestinationMap.length > 0 ? transformedCustomerDestinationMap : [
        { customer: "No Data", destination: "No Data", shipments: 0 }
      ],
      topCustomers: transformedTopCustomers.length > 0 ? transformedTopCustomers : [
        { customer: "No Data", shipments: 0, totalSpent: 0, avgOrderValue: 0 }
      ],
      performanceMetrics: {
        deliveryRate: Math.round(deliveryRate * 10) / 10 || 0,
        avgDeliveryTime: avgDeliveryTime || 0,
        customerSatisfaction: customerSatisfaction || 0,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10 || 0
      },
      growthMetrics: {
        shipmentGrowth: Math.round(shipmentGrowth * 10) / 10 || 0,
        customerGrowth: Math.round(customerGrowth * 10) / 10 || 0
      },
      percentageChanges: {
        shipmentPercentageChange: shipmentPercentageChange || 0,
        customerPercentageChange: customerPercentageChange || 0,
        revenuePercentageChange: revenuePercentageChange || 0,
        receivablePercentageChange: receivablePercentageChange || 0,
      },
      accountsData: {
        accountsReceivable: totalReceivable,
        accountsPayable: totalPayable,
        receivableCustomers: receivableCustomers || [],
        monthlyAccountsData: monthlyAccountsData.length > 0 ? monthlyAccountsData : [
          { month: "Jan", receivable: 0, payable: 0 },
          { month: "Feb", receivable: 0, payable: 0 },
          { month: "Mar", receivable: 0, payable: 0 },
          { month: "Apr", receivable: 0, payable: 0 },
          { month: "May", receivable: 0, payable: 0 },
          { month: "Jun", receivable: 0, payable: 0 },
          { month: "Jul", receivable: 0, payable: 0 },
          { month: "Aug", receivable: 0, payable: 0 },
          { month: "Sep", receivable: 0, payable: 0 },
          { month: "Oct", receivable: 0, payable: 0 },
          { month: "Nov", receivable: 0, payable: 0 },
          { month: "Dec", receivable: 0, payable: 0 }
        ]
      },
      currentMonthData: {
        revenue: currentMonthTotal || 0,
        shipments: currentMonthShipments || 0,
        accountsReceivable: currentMonthReceivableAmount || 0,
        customers: currentMonthCustomers || 0
      }
    };
    
    return NextResponse.json(finalData);
  } catch (error) {
    await reportError(error, { route: "/api/dashboard" });
    return NextResponse.json(
      { error: "Failed to generate dashboard data" },
      { status: 500 }
    );
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "Delivered":
      return "#10B981";
    case "In Transit":
      return "#3B82F6";
    case "Pending":
      return "#F59E0B";
    case "Failed":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}
