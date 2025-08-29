import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Sample data for the enhanced dashboard
    const currentYear = new Date().getFullYear();
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const monthlyEarnings = months.map((month, index) => ({
      month,
      earnings: Math.floor(Math.random() * 500000) + 200000
    }));

    const recentShipments = [
      {
        trackingId: "TRK001",
        senderName: "Ahmed Khan",
        recipientName: "Fatima Ali",
        destination: "Karachi",
        totalCost: 2500,
        status: "Delivered",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        trackingId: "TRK002",
        senderName: "Muhammad Hassan",
        recipientName: "Aisha Khan",
        destination: "Lahore",
        totalCost: 3200,
        status: "In Transit",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        trackingId: "TRK003",
        senderName: "Zara Ahmed",
        recipientName: "Omar Malik",
        destination: "Islamabad",
        totalCost: 1800,
        status: "Pending",
        createdAt: new Date().toISOString()
      },
      {
        trackingId: "TRK004",
        senderName: "Bilal Khan",
        recipientName: "Nadia Ali",
        destination: "Peshawar",
        totalCost: 4100,
        status: "Delivered",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        trackingId: "TRK005",
        senderName: "Sana Khan",
        recipientName: "Hassan Ali",
        destination: "Karachi",
        totalCost: 2800,
        status: "In Transit",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const data = {
      totalShipments: 1247,
      totalUsers: 89,
      totalRevenue: 2847500,
      newOrders: 23,
      monthlyEarnings,
      recentShipments,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to generate dashboard data" },
      { status: 500 }
    );
  }
}
