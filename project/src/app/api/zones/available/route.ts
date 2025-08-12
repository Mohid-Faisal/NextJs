import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get all zone files from the filename table
    const zoneFiles = await prisma.filename.findMany({
      where: {
        fileType: "zone"
      },
      select: {
        id: true,
        filename: true,
        service: true,
        uploadedAt: true
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    console.log("Available zones from database:", zoneFiles);

    return NextResponse.json({
      success: true,
      data: zoneFiles
    });
  } catch (error) {
    console.error("Failed to fetch available zones:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch available zones" },
      { status: 500 }
    );
  }
}
