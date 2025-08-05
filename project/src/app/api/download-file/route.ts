import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");
    const service = searchParams.get("service");

    if (!filename || !service) {
      return NextResponse.json(
        { success: false, message: "Filename and service are required" },
        { status: 400 }
      );
    }

    // Get file information from database
    const fileRecord = await prisma.filename.findFirst({
      where: {
        filename: filename,
        service: service.toLowerCase(),
      },
    });

    if (!fileRecord) {
      return NextResponse.json(
        { success: false, message: "File not found in database" },
        { status: 404 }
      );
    }

    // For now, we'll return a placeholder response since we don't have the actual file stored
    // In a real implementation, you would store the file in a file system or cloud storage
    // and return the actual file content here
    
    // Create a simple Excel file with the zone data as a fallback
    const zoneData = await prisma.zone.findMany({
      where: {
        service: service.toLowerCase(),
      },
    });

    if (zoneData.length === 0) {
      return NextResponse.json(
        { success: false, message: "No zone data found for this service" },
        { status: 404 }
      );
    }

    // Create a simple CSV content as a fallback
    const csvContent = [
      "Code,Country,Zone,Phone Code",
      ...zoneData.map(zone => 
        `${zone.code || ""},${zone.country},${zone.zone},${(zone as any).phoneCode || ""}`
      )
    ].join("\n");

    // Return the CSV content as a downloadable file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename.replace(/\.(xlsx|xls)$/, '.csv')}"`,
      },
    });

  } catch (error) {
    console.error("❌ Error downloading file:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error downloading file",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
} 