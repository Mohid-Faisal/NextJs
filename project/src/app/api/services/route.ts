import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const services = await prisma.serviceMode.findMany({
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error("❌ Error fetching services:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to fetch services",
      error: (error as Error).message
    }, { status: 500 });
  }
} 