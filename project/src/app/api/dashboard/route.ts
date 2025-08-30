import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    // Test basic database connectivity and data
    console.log('=== TESTING DATABASE CONNECTIVITY ===');
    const testShipment = await prisma.shipment.findFirst();
    const testCustomer = await prisma.customers.findFirst();
    const testInvoice = await prisma.invoice.findFirst();
    
    console.log('Test Data:', {
      hasShipments: !!testShipment,
      hasCustomers: !!testCustomer,
      hasInvoices: !!testInvoice,
      sampleShipment: testShipment ? { id: testShipment.id, destination: testShipment.destination } : null,
      sampleCustomer: testCustomer ? { id: testCustomer.id, CompanyName: testCustomer.CompanyName } : null,
      sampleInvoice: testInvoice ? { id: testInvoice.id, destination: testInvoice.destination, totalAmount: testInvoice.totalAmount } : null
    });
    console.log('=== END TESTING ===');
    
    // Get total shipments
    const totalShipments = await prisma.shipment.count();
    
    // Get total customers
    const totalUsers = await prisma.customers.count();
    
    // Get total revenue from customer invoices
    const totalRevenueResult = await prisma.invoice.aggregate({
      where: {
        customerId: { not: null }, // Only customer invoices
        status: { not: "Cancelled" }
      },
      _sum: {
        totalAmount: true
      }
    });
    const totalRevenue = totalRevenueResult._sum.totalAmount || 0;
    
    // Get new orders (shipments created this month)
    const newOrders = await prisma.shipment.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      }
    });
    
    // Get monthly earnings for the current year
    const monthlyEarnings = [];
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(currentYear, month, 1);
      const endDate = new Date(currentYear, month + 1, 1);
      
      const monthRevenue = await prisma.invoice.aggregate({
        where: {
          customerId: { not: null },
          status: { not: "Cancelled" },
          createdAt: {
            gte: startDate,
            lt: endDate
          }
        },
        _sum: {
          totalAmount: true
        }
      });
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      monthlyEarnings.push({
        month: monthNames[month],
        earnings: monthRevenue._sum.totalAmount || 0
      });
    }
    
    // Get recent shipments with real data
    const recentShipments = await prisma.shipment.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
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
        createdAt: true
      }
    });
    
    // Transform recent shipments to match expected format
    const transformedRecentShipments = recentShipments.map(shipment => ({
      id: shipment.id,
      trackingId: shipment.trackingId,
      invoiceNumber: shipment.invoiceNumber,
      senderName: shipment.senderName,
      recipientName: shipment.recipientName,
      destination: shipment.destination,
      totalCost: shipment.totalCost,
      status: shipment.deliveryStatus || "Pending",
      invoiceStatus: shipment.invoiceStatus || "Pending",
      packaging: shipment.packaging || "N/A",
      amount: shipment.amount || 1,
      totalWeight: shipment.totalWeight || shipment.weight || 0,
      shipmentDate: shipment.shipmentDate || shipment.createdAt,
      createdAt: shipment.createdAt.toISOString()
    }));
    
    // Get recent payments from the main Payment table
    const recentPayments = await prisma.payment.findMany({
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
        partyName = `${payment.fromCustomer || 'N/A'} → ${payment.toVendor || 'N/A'}`;
        partyType = 'Transfer';
      }
      
      return {
        id: payment.id,
        type: payment.transactionType,
        amount: payment.amount,
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
      _count: {
        id: true
      }
    });
    
    const shipmentStatusDistribution = shipmentStatuses.map(status => ({
      status: status.deliveryStatus || "Pending",
      count: status._count.id,
      color: getStatusColor(status.deliveryStatus || "Pending")
    }));
    
    // Get revenue by destination - fix to use shipment destinations and calculate revenue properly
    const revenueByDestination = await prisma.shipment.groupBy({
      by: ['destination'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });
    
    // Calculate revenue for each destination by looking up invoices
    const revenueByDestinationWithRevenue = await Promise.all(
      revenueByDestination.map(async (dest) => {
        const destinationRevenue = await prisma.invoice.aggregate({
          where: {
            destination: dest.destination,
            customerId: { not: null },
            status: { not: "Cancelled" }
          },
          _sum: {
            totalAmount: true
          }
        });
        
        return {
          destination: dest.destination,
          revenue: destinationRevenue._sum.totalAmount || 0,
          shipments: dest._count.id
        };
      })
    );
    
    const transformedRevenueByDestination = revenueByDestinationWithRevenue;
    
    // Get monthly shipments count
    const monthlyShipments = [];
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(currentYear, month, 1);
      const endDate = new Date(currentYear, month + 1, 1);
      
      const monthShipments = await prisma.shipment.count({
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate
          }
        }
      });
      
      const monthRevenue = await prisma.invoice.aggregate({
        where: {
          customerId: { not: null },
          status: { not: "Cancelled" },
          createdAt: {
            gte: startDate,
            lt: endDate
          }
        },
        _sum: {
          totalAmount: true
        }
      });
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      monthlyShipments.push({
        month: monthNames[month],
        shipments: monthShipments,
        revenue: monthRevenue._sum.totalAmount || 0
      });
    }
    
    // Get top destinations with revenue - fix to properly calculate revenue
    const topDestinations = await prisma.shipment.groupBy({
      by: ['destination'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });
    
    // Calculate revenue for each destination
    const topDestinationsWithRevenue = await Promise.all(
      topDestinations.map(async (dest) => {
        const destinationRevenue = await prisma.invoice.aggregate({
          where: {
            destination: dest.destination,
            customerId: { not: null },
            status: { not: "Cancelled" }
          },
          _sum: {
            totalAmount: true
          }
        });
        
        return {
          destination: dest.destination,
          shipments: dest._count.id,
          revenue: destinationRevenue._sum.totalAmount || 0
        };
      })
    );
    
    const transformedTopDestinations = topDestinationsWithRevenue;
    
    // Get customer-destination relationship - show top customers and their preferred destinations
    const customerDestinationMap = await prisma.customers.findMany({
      select: {
        CompanyName: true,
        invoices: {
          where: {
            status: { not: "Cancelled" }
          },
          select: {
            destination: true,
            totalAmount: true
          }
        }
      },
      take: 8
    });
    
    const transformedCustomerDestinationMap = customerDestinationMap
      .filter(customer => customer.invoices.length > 0)
      .map(customer => {
        // Get the most frequent destination for this customer
        const destinationCounts = customer.invoices.reduce((acc, invoice) => {
          acc[invoice.destination] = (acc[invoice.destination] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const preferredDestination = Object.entries(destinationCounts)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
        
        return {
          customer: customer.CompanyName,
          destination: preferredDestination,
          shipments: customer.invoices.length
        };
      })
      .sort((a, b) => b.shipments - a.shipments)
      .slice(0, 8);
    
    // Get top customers by shipment count and revenue
    const topCustomers = await prisma.customers.findMany({
      select: {
        CompanyName: true,
        currentBalance: true,
        invoices: {
          where: {
            status: { not: "Cancelled" }
          },
          select: {
            totalAmount: true
          }
        }
      },
      take: 10
    });
    
    const transformedTopCustomers = topCustomers.map(customer => {
      const totalSpent = customer.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
      const shipments = customer.invoices.length;
      const avgOrderValue = shipments > 0 ? totalSpent / shipments : 0;
      
      return {
        customer: customer.CompanyName,
        shipments,
        totalSpent,
        avgOrderValue,
        currentBalance: customer.currentBalance || 0
      };
    });
    
    // Calculate performance metrics
    const totalDelivered = await prisma.shipment.count({
      where: {
        deliveryStatus: "Delivered"
      }
    });
    
    const deliveryRate = totalShipments > 0 ? (totalDelivered / totalShipments) * 100 : 0;
    
    // Calculate average delivery time from actual delivery data
    let avgDeliveryTime = 0;
    if (totalDelivered > 0) {
      const deliveredShipments = await prisma.shipment.findMany({
        where: {
          deliveryStatus: "Delivered"
        },
        select: {
          createdAt: true,
          shipmentDate: true
        }
      });
      
      // Calculate average days between creation and shipment date
      const totalDays = deliveredShipments.reduce((sum, shipment) => {
        const shipmentDate = shipment.shipmentDate;
        const creationDate = shipment.createdAt;
        const daysDiff = Math.ceil((shipmentDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, daysDiff); // Ensure non-negative
      }, 0);
      
      avgDeliveryTime = totalDays > 0 ? Math.round((totalDays / deliveredShipments.length) * 10) / 10 : 0;
    }
    
    // Calculate customer satisfaction based on delivery success rate
    let customerSatisfaction = 0;
    if (totalShipments > 0) {
      const failedShipments = await prisma.shipment.count({
        where: {
          deliveryStatus: "Failed"
        }
      });
      
      const successRate = ((totalShipments - failedShipments) / totalShipments) * 100;
      // Convert success rate to 5-star scale (90%+ = 5 stars, 80%+ = 4 stars, etc.)
      if (successRate >= 90) customerSatisfaction = 5.0;
      else if (successRate >= 80) customerSatisfaction = 4.5;
      else if (successRate >= 70) customerSatisfaction = 4.0;
      else if (successRate >= 60) customerSatisfaction = 3.5;
      else if (successRate >= 50) customerSatisfaction = 3.0;
      else customerSatisfaction = 2.5;
    }
    
    // Calculate revenue growth (comparing current month with previous month)
    const currentMonthRevenue = await prisma.invoice.aggregate({
      where: {
        customerId: { not: null },
        status: { not: "Cancelled" },
        createdAt: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      },
      _sum: {
        totalAmount: true
      }
    });
    
    const previousMonthRevenue = await prisma.invoice.aggregate({
      where: {
        customerId: { not: null },
        status: { not: "Cancelled" },
        createdAt: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1)
        }
      },
      _sum: {
        totalAmount: true
      }
    });
    
    const currentMonthTotal = currentMonthRevenue._sum.totalAmount || 0;
    const previousMonthTotal = previousMonthRevenue._sum.totalAmount || 0;
    const revenueGrowth = previousMonthTotal > 0 ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100 : 0;
    
    // Calculate shipment growth rate (comparing current month with previous month)
    const currentMonthShipments = await prisma.shipment.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      }
    });
    
    const previousMonthShipments = await prisma.shipment.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1)
        }
      }
    });
    
    const shipmentGrowth = previousMonthShipments > 0 ? ((currentMonthShipments - previousMonthShipments) / previousMonthShipments) * 100 : 0;
    
    // Calculate customer growth rate
    const currentMonthCustomers = await prisma.customers.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      }
    });
    
    const previousMonthCustomers = await prisma.customers.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1)
        }
      }
    });
    
    const customerGrowth = previousMonthCustomers > 0 ? ((currentMonthCustomers - previousMonthCustomers) / previousMonthCustomers) * 100 : 0;
    
    // Calculate accounts payable and receivable
    const accountsReceivable = await prisma.customers.aggregate({
      _sum: {
        currentBalance: true
      }
    });
    
    const accountsPayable = await prisma.vendors.aggregate({
      _sum: {
        currentBalance: true
      }
    });
    
    // Get monthly accounts data for trends
    const monthlyAccountsData = [];
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(currentYear, month, 1);
      const endDate = new Date(currentYear, month + 1, 1);
      
      const monthReceivable = await prisma.customers.aggregate({
        where: {
          createdAt: { lte: endDate }
        },
        _sum: {
          currentBalance: true
        }
      });
      
      const monthPayable = await prisma.vendors.aggregate({
        where: {
          createdAt: { lte: endDate }
        },
        _sum: {
          currentBalance: true
        }
      });
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      monthlyAccountsData.push({
        month: monthNames[month],
        receivable: monthReceivable._sum.currentBalance || 0,
        payable: monthPayable._sum.currentBalance || 0
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
    
    const data = {
      totalShipments,
      totalUsers,
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
        revenuePercentageChange
      },
      accountsData: {
        accountsReceivable: accountsReceivable._sum.currentBalance || 0,
        accountsPayable: accountsPayable._sum.currentBalance || 0,
        monthlyAccountsData
      }
    };
    
    // Debug logging
    console.log('Dashboard Data:', {
      totalShipments,
      totalUsers,
      totalRevenue,
      revenueByDestination: transformedRevenueByDestination,
      topDestinations: transformedTopDestinations,
      customerDestinationMap: transformedCustomerDestinationMap
    });
    
    // Additional debugging for problematic charts
    console.log('=== DEBUGGING PROBLEMATIC CHARTS ===');
    console.log('1. Revenue by Destination:', {
      raw: revenueByDestination,
      transformed: transformedRevenueByDestination,
      length: transformedRevenueByDestination.length
    });
    console.log('2. Top Destinations:', {
      raw: topDestinations,
      transformed: transformedTopDestinations,
      length: transformedTopDestinations.length
    });
    console.log('3. Customer Destination Map:', {
      raw: customerDestinationMap,
      transformed: transformedCustomerDestinationMap,
      length: transformedCustomerDestinationMap.length
    });
    console.log('=== END DEBUGGING ===');
    
    // Ensure all arrays have data, if not provide fallback data
    const finalData = {
      totalShipments: totalShipments || 0,
      totalUsers: totalUsers || 0,
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
        revenuePercentageChange: revenuePercentageChange || 0
      },
      accountsData: {
        accountsReceivable: accountsReceivable._sum.currentBalance || 0,
        accountsPayable: accountsPayable._sum.currentBalance || 0,
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
      }
    };
    
    return NextResponse.json(finalData);
  } catch (error) {
    console.error("Error generating dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to generate dashboard data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
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
