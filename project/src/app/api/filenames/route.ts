import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, vendor, service } = body;

    if (!filename || !vendor || !service) {
      return NextResponse.json(
        { success: false, message: "Missing filename, vendor, or service" },
        { status: 400 }
      );
    }

    // Delete existing filename record for this vendor-service combination
    await prisma.filename.deleteMany({
      where: {
        vendor: vendor,
        service: service,
      },
    });

    // Store new filename
    await prisma.filename.create({
      data: {
        filename: filename,
        vendor: vendor,
        service: service,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Filename stored successfully",
    });
  } catch (error) {
    console.error("❌ Error storing filename:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error storing filename",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor = searchParams.get("vendor");
    const service = searchParams.get("service");

    if (!vendor || !service) {
      return NextResponse.json({
        success: false,
        message: "Vendor and service are required",
        data: null,
      });
    }

    const filenameRecord = await prisma.filename.findFirst({
      where: {
        vendor: vendor,
        service: service,
      },
    });

    return NextResponse.json({
      success: true,
      data: filenameRecord,
    });
  } catch (error) {
    console.error("❌ Error retrieving filename:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error retrieving filename",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
} 