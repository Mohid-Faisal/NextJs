import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Month labels (can be localized)
const monthLabels = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function GET() {
  const currentYear = new Date().getFullYear();

  const [
    totalShipments,
    totalUsers,
    totalRevenue,
    recentShipmentsCount,
    monthlyRaw,
    recentShipments
  ] = await Promise.all([
    prisma.shipment.count(),
    prisma.user.count(),
    prisma.shipment.aggregate({
      _sum: {
        totalCost: true,
      },
    }),
    prisma.shipment.count({
      where: { 
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 7)), // Last 7 days
        }
      },
    }),
    prisma.shipment.groupBy({
      by: ["createdAt"],
      _sum: {
        totalCost: true,
      },
      where: {
        createdAt: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
      },
    }),
    prisma.shipment.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        trackingId: true,
        senderName: true,
        recipientName: true,
        destination: true,
        totalCost: true,
        createdAt: true,
      },
    }),
  ]);

  // Process and group monthly totals
  const monthlyTotalsMap: { [key: number]: number } = {};

  for (const entry of monthlyRaw) {
    const month = new Date(entry.createdAt).getMonth(); // 0-11
    monthlyTotalsMap[month] = (monthlyTotalsMap[month] || 0) + (entry._sum.totalCost || 0);
  }

  const monthlyEarnings = monthLabels.map((label, idx) => ({
    month: label,
    earnings: monthlyTotalsMap[idx] || 0,
  }));

  return NextResponse.json({
    totalShipments,
    totalUsers,
    totalRevenue: totalRevenue._sum.totalCost || 0,
    recentShipmentsCount,
    monthlyEarnings,
    recentShipments,
  });
}
